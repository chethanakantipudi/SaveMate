const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const env = process.env;

const sequelize = new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASS, {
    host: env.DB_HOST,
    dialect: 'mysql',
    logging: false
});

// User Model with Password Hashing
const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    username: { type: DataTypes.STRING, unique: true, allowNull: false },
    password: { type: DataTypes.STRING, allowNull: false },
    fname: DataTypes.STRING,
    lname: DataTypes.STRING,
    email: DataTypes.STRING,
    currency: { type: DataTypes.STRING, defaultValue: '£' },
    total_currently_saved: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 }
}, {
    hooks: {
        beforeCreate: async (user) => {
            if (user.password) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
            }
        }
    }
});

// Method to check password
User.prototype.validPassword = async function(password) {
    return await bcrypt.compare(password, this.password);
};

// Goal Model
const Goal = sequelize.define('Goal', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    goal_name: { type: DataTypes.STRING, allowNull: false },
    end_total: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    current_total: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    achieved: { type: DataTypes.BOOLEAN, defaultValue: false },
    image_url: DataTypes.STRING,
    deposits_number: { type: DataTypes.INTEGER, defaultValue: 0 },
    withdrawals_number: { type: DataTypes.INTEGER, defaultValue: 0 }
});

// Transaction Model
const Transaction = sequelize.define('Transaction', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    type: { type: DataTypes.ENUM('deposit', 'withdrawal'), allowNull: false },
    date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

// AppStats Model
const AppStats = sequelize.define('AppStats', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    users_total: { type: DataTypes.INTEGER, defaultValue: 0 },
    saved_total: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    achieved_goals: { type: DataTypes.INTEGER, defaultValue: 0 }
});

// Relationships
User.hasMany(Goal);
Goal.belongsTo(User);
Goal.hasMany(Transaction);
Transaction.belongsTo(Goal);
User.hasMany(Transaction);
Transaction.belongsTo(User);

// Function to initialize database
async function initDatabase() {
    try {
        // Test the connection
        await sequelize.authenticate();
        console.log('Database connection successful.');
        
        // Sync models with database
        await sequelize.sync({ alter: true });
        console.log('Database schema synchronized.');
        
        // Initialize AppStats
        const [stats, created] = await AppStats.findOrCreate({ 
            where: { id: 1 },
            defaults: {
                users_total: 0,
                saved_total: 0,
                achieved_goals: 0
            }
        });
        console.log(created ? 'AppStats initialized.' : 'AppStats already exists.');
        
        return true;
    } catch (error) {
        console.error('Database initialization error:', error);
        throw error; // Re-throw to handle in app.js
    }
}

module.exports = { sequelize, User, Goal, Transaction, AppStats, initDatabase };