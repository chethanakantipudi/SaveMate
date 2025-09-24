require('dotenv').config();

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const { sequelize, User, Goal, Transaction, AppStats, initDatabase } = require('./models/db');
const { generateResponse } = require('./services/chatbotService');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: true
}));

// Serve static assets from public folder
app.use('/public', express.static(path.join(__dirname, 'public')));

// Initialize database
initDatabase().catch(console.error);

// Helper to load app stats
async function loadAppStats() {
  const stats = await AppStats.findByPk(1);
  return stats ? stats : { users_total: 0, saved_total: 0, achieved_goals: 0 };
}

app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

app.get('/', async (req, res) => {
  try {
    const app_stats = await loadAppStats();
    const user = req.session.user;
    res.render('index', { app_stats, user });
  } catch (error) {
    console.error('Home page error:', error);
    res.status(500).send('Server error');
  }
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({
      where: { username },
      include: [{
        model: Goal,
        include: [Transaction]
      }]
    });

    if (!user || !(await user.validPassword(password))) {
      if (req.headers['content-type'] === 'application/json') {
        return res.status(401).json({ message: 'Invalid username or password' });
      }
      return res.redirect('/login');
    }

    const userForSession = user.toJSON();
    delete userForSession.password;
    req.session.user = userForSession;

    if (req.headers['content-type'] === 'application/json') {
      return res.json({ redirectUrl: '/dashboard' });
    }

    return res.redirect('/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    if (req.headers['content-type'] === 'application/json') {
      return res.status(500).json({ message: 'Server error occurred' });
    }
    res.redirect('/login');
  }
});

app.get('/signup', (req, res) => {
  res.render('signup');
});

app.post('/signup', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const newUser = await sequelize.transaction(async (t) => {
      const user = await User.create({
        username,
        password,
        fname: username,
        lname: '',
        currency: '£'
      }, { transaction: t });

      const stats = await AppStats.findByPk(1, { transaction: t });
      if (stats) {
        await stats.increment('users_total', { by: 1, transaction: t });
      }

      return user;
    });

    const userForSession = newUser.toJSON();
    delete userForSession.password;
    req.session.user = userForSession;

    return res.redirect('/dashboard');
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ message: 'Failed to create account' });
  }
});

// FIXED: Dashboard route with proper transaction filtering to prevent null Goal errors
app.get('/dashboard', async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login');

    const user = await User.findByPk(req.session.user.id, {
      include: [{
        model: Goal,
        include: [Transaction]
      }],
      order: [[Goal, 'createdAt', 'DESC']]
    });

    const app_stats = await loadAppStats();
    const goals = user.Goals || [];

    // FIXED: Only get transactions that have associated goals (filter out orphaned transactions)
    const user_savings_history = await Transaction.findAll({
      where: { UserId: user.id },
      include: [{
        model: Goal,
        required: true // This ensures only transactions with existing goals are returned
      }],
      order: [['date', 'DESC']],
      limit: 10
    });

    const chart_labels = JSON.stringify([]);
    const chart_data = JSON.stringify([]);

    res.render('dashboard', {
      user,
      goals,
      user_savings_history,
      chart_labels,
      chart_data,
      app_stats
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Server error');
  }
});

app.get('/goal/:id', async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login');

    const goal = await Goal.findOne({
      where: { id: req.params.id, UserId: req.session.user.id },
      include: [{
        model: Transaction,
        separate: true,
        order: [['date', 'DESC']]
      }]
    });

    if (!goal) {
      return res.redirect('/dashboard');
    }

    const user = await User.findByPk(req.session.user.id);
    res.render('viewgoal', { user, goal });
  } catch (error) {
    console.error('View goal error:', error);
    res.redirect('/dashboard');
  }
});

app.get('/add_goal', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.render('add_goal', { user: req.session.user });
});

// FIXED: Add goal route with explicit achieved: false
app.post('/add_goal', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: 'Please login to create a goal' });
    }

    const { goal_name, goal_amount, goal_date, image_url } = req.body;

    if (!goal_name || !goal_amount || !goal_date) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // FIXED: Explicitly set achieved to false for new goals
    await Goal.create({
      UserId: req.session.user.id,
      goal_name: goal_name.trim(),
      end_total: parseFloat(goal_amount),
      end_date: goal_date,
      current_total: 0,
      achieved: false, // EXPLICIT: New goals are not achieved
      image_url: image_url || '/public/img/goal-icons/default.png',
    });

    return res.json({ redirectUrl: '/dashboard' });
  } catch (error) {
    console.error('Add goal error:', error);
    return res.status(500).json({ message: 'Failed to create goal' });
  }
});

// FIXED: Transaction route with proper achievement checking
app.post('/goal/:id/transaction', async (req, res) => {
  const goalId = req.params.id;
  try {
    if (!req.session.user) {
      if (req.headers['content-type'] === 'application/json') {
        return res.status(401).json({ message: 'Authentication required' });
      }
      return res.redirect('/login');
    }

    const { amount, type } = req.body;
    const parsedAmount = Math.abs(parseFloat(amount));

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      if (req.headers['content-type'] === 'application/json') {
        return res.status(400).json({ message: 'Invalid amount provided' });
      }
      return res.redirect(`/goal/${goalId}`);
    }

    let updatedGoal, newTransaction, user;

    await sequelize.transaction(async (t) => {
      const goal = await Goal.findOne({
        where: { id: goalId, UserId: req.session.user.id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!goal) {
        throw new Error('Goal not found');
      }

      // Check for insufficient funds on withdrawal BEFORE creating transaction
      const updateAmount = type === 'deposit' ? parsedAmount : -parsedAmount;
      if (goal.current_total + updateAmount < 0) {
        throw new Error('Withdrawal amount exceeds current savings.');
      }

      // Create the transaction record
      newTransaction = await Transaction.create({
        UserId: req.session.user.id,
        GoalId: goalId,
        amount: parsedAmount,
        type,
        date: new Date(), // Ensure date is set
      }, { transaction: t });

      user = await User.findByPk(req.session.user.id, { 
        transaction: t, 
        lock: t.LOCK.UPDATE 
      });

      // Update goal current total
      await goal.increment('current_total', { by: updateAmount, transaction: t });

      // Update user total savings
      await user.increment('total_currently_saved', { by: updateAmount, transaction: t });

      // Only update global stats for deposits
      if (type === 'deposit') {
        const stats = await AppStats.findByPk(1, { transaction: t, lock: t.LOCK.UPDATE });
        if (stats) await stats.increment('saved_total', { by: parsedAmount, transaction: t });
      }

      // Reload the goal to get updated values
      await goal.reload({ transaction: t });

      // FIXED: Proper achievement checking - only mark as achieved when actually reaching the target
      const wasAchieved = goal.achieved;
      const isNowAchieved = goal.current_total >= goal.end_total;
      
      if (!wasAchieved && isNowAchieved) {
        // Goal just became achieved
        await goal.update({ achieved: true }, { transaction: t });
        const stats = await AppStats.findByPk(1, { transaction: t, lock: t.LOCK.UPDATE });
        if (stats) await stats.increment('achieved_goals', { transaction: t });
      } else if (wasAchieved && !isNowAchieved) {
        // Goal was achieved but now isn't (due to withdrawal)
        await goal.update({ achieved: false }, { transaction: t });
        const stats = await AppStats.findByPk(1, { transaction: t, lock: t.LOCK.UPDATE });
        if (stats) await stats.decrement('achieved_goals', { transaction: t });
      }

      updatedGoal = goal;
    });

    // Update session user data
    req.session.user.total_currently_saved = user.total_currently_saved;

    // For AJAX requests, return JSON
    if (req.headers['content-type'] === 'application/json') {
      // Include the Goal association for the transaction
      const transactionWithGoal = {
        ...newTransaction.toJSON(),
        Goal: { goal_name: updatedGoal.goal_name }
      };

      return res.json({
        success: true,
        message: `${type === 'deposit' ? 'Deposit' : 'Withdrawal'} successful`,
        updatedGoal: updatedGoal.toJSON(),
        newTransaction: transactionWithGoal
      });
    }

    // For regular form submissions, redirect
    res.redirect(`/goal/${goalId}`);

  } catch (error) {
    console.error('Transaction Error:', error);
    
    if (req.headers['content-type'] === 'application/json') {
      return res.status(400).json({ 
        success: false, 
        message: error.message || 'Transaction failed' 
      });
    }
    
    res.redirect(`/goal/${goalId}`);
  }
});

// Route to show the edit goal page
app.get('/goal/:id/edit', async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login');

    const goal = await Goal.findOne({
      where: { id: req.params.id, UserId: req.session.user.id }
    });

    if (!goal) return res.redirect('/dashboard');

    // Pre-format date for the HTML input field
    const date = new Date(goal.end_date);
    const formattedDate = date.toISOString().split('T')[0];

    res.render('edit_goal', { user: req.session.user, goal, formattedDate });
  } catch (error) {
    console.error('Edit goal page error:', error);
    res.redirect('/dashboard');
  }
});

// FIXED: Route to handle the update form submission with proper achievement logic
app.post('/goal/:id/edit', async (req, res) => {
  const goalId = req.params.id;
  try {
    if (!req.session.user) return res.redirect('/login');

    const { goal_name, goal_amount, goal_date } = req.body;

    const goal = await Goal.findOne({
      where: { id: goalId, UserId: req.session.user.id }
    });

    if (!goal) return res.redirect('/dashboard');

    await sequelize.transaction(async (t) => {
      // Update goal details
      await goal.update({
        goal_name: goal_name.trim(),
        end_total: parseFloat(goal_amount),
        end_date: goal_date
      }, { transaction: t });

      // FIXED: Recalculate achievement status after editing
      const wasAchieved = goal.achieved;
      const isNowAchieved = goal.current_total >= parseFloat(goal_amount);
      
      if (wasAchieved !== isNowAchieved) {
        await goal.update({ achieved: isNowAchieved }, { transaction: t });
        
        // Update global stats
        const stats = await AppStats.findByPk(1, { transaction: t });
        if (stats) {
          if (isNowAchieved && !wasAchieved) {
            await stats.increment('achieved_goals', { transaction: t });
          } else if (!isNowAchieved && wasAchieved) {
            await stats.decrement('achieved_goals', { transaction: t });
          }
        }
      }
    });

    res.redirect(`/goal/${goalId}`);
  } catch (error) {
    console.error('Update goal error:', error);
    res.redirect(`/goal/${goalId}/edit`);
  }
});

// FIXED: Route to handle deleting a goal with proper JSON response and transaction cleanup
app.post('/goal/:id/delete', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const t = await sequelize.transaction();
  try {
    const goal = await Goal.findOne({
      where: { id: req.params.id, UserId: req.session.user.id },
      transaction: t
    });

    if (!goal) throw new Error('Goal not found.');

    const user = await User.findByPk(req.session.user.id, { transaction: t });

    // First, delete all transactions associated with this goal
    await Transaction.destroy({
      where: { GoalId: req.params.id },
      transaction: t
    });

    // Subtract the goal's saved amount from the user's total
    if (goal.current_total > 0) {
      await user.decrement('total_currently_saved', { by: goal.current_total, transaction: t });
    }

    // If the goal was achieved, decrement the achieved goals counter
    if (goal.achieved) {
      const stats = await AppStats.findByPk(1, { transaction: t, lock: t.LOCK.UPDATE });
      if (stats) await stats.decrement('achieved_goals', { transaction: t });
    }

    await goal.destroy({ transaction: t });
    await t.commit();

    res.json({ message: 'Goal deleted successfully.', redirectUrl: '/dashboard' });
  } catch (error) {
    await t.rollback();
    console.error('Delete goal error:', error);
    res.status(500).json({ message: 'Failed to delete goal.' });
  }
});

// FIXED: AI Chatbot API route
app.post('/api/chatbot', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ 
        reply: "I'm sorry, but you need to be logged in to chat with me. Please log in and try again." 
      });
    }

    const { message } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ 
        reply: "I didn't receive your message. Could you please try asking again?" 
      });
    }

    // Get user data for AI context
    const user = await User.findByPk(req.session.user.id, {
      include: [{
        model: Goal,
        include: [Transaction]
      }]
    });

    const goals = user.Goals || [];
    
    // FIXED: Only get transactions with existing goals for AI context
    const transactions = await Transaction.findAll({
      where: { UserId: user.id },
      include: [{
        model: Goal,
        required: true // Only include transactions with valid goals
      }],
      order: [['date', 'DESC']],
      limit: 10
    });

    const userData = {
      user: user.toJSON(),
      goals: goals.map(g => g.toJSON()),
      transactions: transactions.map(t => t.toJSON())
    };

    const reply = await generateResponse(message.trim(), userData);
    
    res.json({ reply });
  } catch (error) {
    console.error('Chatbot API error:', error);
    res.status(500).json({ 
      reply: "I'm sorry, I'm having some technical difficulties right now. Please try again in a moment!" 
    });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// FIXED: Savings history route with proper transaction filtering
app.get('/savingshistory', async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login');

    const userId = req.session.user.id;
    const goalId = req.query.goal;

    // If a goal id is provided, show history for that goal
    if (goalId) {
      const goal = await Goal.findOne({
        where: { id: goalId, UserId: userId },
        include: [{ model: Transaction, separate: true, order: [['date', 'DESC']] }]
      });

      if (!goal) return res.redirect('/dashboard');

      // Map goal transactions into the legacy savings_history format if needed
      const goalHistory = (goal.Transactions || []).map(tx => [tx.date, (tx.type === 'deposit' ? Number(tx.amount) : -Number(tx.amount))]);

      return res.render('savingshistory', {
        user: req.session.user,
        historytype: 'goal',
        goal: Object.assign(goal.toJSON(), { savings_history: goalHistory }),
        user_savings_history: []
      });
    }

    // FIXED: Otherwise show user-level history (only transactions with existing goals)
    const user_savings_history = await Transaction.findAll({
      where: { UserId: userId },
      include: [{
        model: Goal,
        required: true // Only include transactions with valid goals
      }],
      order: [['date', 'DESC']]
    });

    res.render('savingshistory', {
      user: req.session.user,
      historytype: 'user',
      user_savings_history,
      goal: null
    });
  } catch (error) {
    console.error('Savings history error:', error);
    res.redirect('/dashboard');
  }
});

// Route: User profile
app.get('/profile', async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login');

    const user = await User.findByPk(req.session.user.id, {
      include: [{ model: Goal }],
      order: [[Goal, 'createdAt', 'DESC']]
    });

    if (!user) return res.redirect('/login');

    const goals = user.Goals || [];
    res.render('profile', { user: req.session.user, goals });
  } catch (error) {
    console.error('Profile page error:', error);
    res.redirect('/dashboard');
  }
});

app.listen(PORT, () => console.log(`Server started on http://localhost:${PORT}`));