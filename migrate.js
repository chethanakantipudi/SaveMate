require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { User, Goal, Transaction, AppStats, initDatabase } = require('./models/db');

async function migrateData() {
    try {
        // Initialize database first
        await initDatabase();
        console.log('Database initialized');

        // Create initial AppStats if not exists
        let stats = await AppStats.findByPk(1);
        if (!stats) {
            stats = await AppStats.create({
                users_total: 0,
                saved_total: 0,
                achieved_goals: 0
            });
            console.log('Created initial app stats');
        } else {
            console.log('App stats already exist');
        }

        // Read users.json
        const usersData = JSON.parse(fs.readFileSync(path.join(__dirname, 'users.json'), 'utf8'));
        
        // Handle both object and array formats
        const users = Array.isArray(usersData) 
            ? usersData 
            : Object.entries(usersData).map(([username, password]) => ({
                username,
                password,
                fname: username,
                lname: '',
                currency: '£',
                goals: []
            }));

        console.log(`Found ${users.length} users to migrate`);

        // Migrate each user and their goals
        for (const userData of users) {
            // Check if user already exists
            let user = await User.findOne({ where: { username: userData.username } });
            
            if (!user) {
                user = await User.create({
                    username: userData.username,
                    password: userData.password, // In production, ensure passwords are hashed
                    fname: userData.fname || userData.username,
                    lname: userData.lname || '',
                    email: userData.email,
                    currency: userData.currency || '£',
                    total_currently_saved: userData.total_currently_saved || 0
                });
                console.log(`Created new user: ${userData.username}`);
                
                // Update app stats
                await stats.increment('users_total');
            } else {
                console.log(`User ${userData.username} already exists, skipping...`);
            }

            // Migrate goals if they exist
            if (userData.goals && Array.isArray(userData.goals)) {
                for (const goalData of userData.goals) {
                    const existingGoal = await Goal.findOne({ 
                        where: { 
                            UserId: user.id,
                            goal_name: goalData.goal_name
                        }
                    });

                    if (!existingGoal) {
                        const goal = await Goal.create({
                            UserId: user.id,
                            goal_name: goalData.goal_name,
                            end_total: goalData.end_total,
                            current_total: goalData.current_total || 0,
                            start_date: goalData.start_date || new Date(),
                            end_date: goalData.end_date,
                            achieved: goalData.achieved || false,
                            image_url: goalData.image_url,
                            deposits_number: goalData.deposits_number || 0,
                            withdrawals_number: goalData.withdrawals_number || 0
                        });
                        console.log(`Created goal: ${goal.goal_name} for user ${user.username}`);

                        // Migrate savings history if it exists
                        if (goalData.savings_history && Array.isArray(goalData.savings_history)) {
                            for (const transaction of goalData.savings_history) {
                                await Transaction.create({
                                    UserId: user.id,
                                    GoalId: goal.id,
                                    amount: transaction[1],
                                    type: transaction[1] > 0 ? 'deposit' : 'withdrawal',
                                    date: transaction[0]
                                });
                            }
                            console.log(`Migrated ${goalData.savings_history.length} transactions for goal ${goal.goal_name}`);
                        }

                        if (goal.achieved) {
                            await stats.increment('achieved_goals');
                        }
                        if (goal.current_total > 0) {
                            await stats.increment('saved_total', { by: goal.current_total });
                        }
                    } else {
                        console.log(`Goal ${goalData.goal_name} already exists for user ${user.username}, skipping...`);
                    }
                }
            }
        }

        console.log('Data migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Migration error:', error);
        process.exit(1);
    }
}

migrateData();