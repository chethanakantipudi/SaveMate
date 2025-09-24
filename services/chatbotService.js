// Fixed chatbotService.js - Simple AI responder without external dependencies

/**
 * Formats user's savings data into a natural language string for the AI.
 * @param {object} user - The user object from Sequelize.
 * @param {Array} goals - An array of the user's goals.
 * @param {Array} transactions - An array of recent transactions.
 * @returns {string} A formatted string containing all the user's data.
 */
function formatUserDataForAI(user, goals, transactions) {
    let context = `User Information:\n- User's name: ${user.fname}\n- Total amount saved across all goals: ${user.currency}${user.total_currently_saved}\n\n`;
    
    if (goals.length > 0) {
        context += "Savings Goals:\n";
        goals.forEach(goal => {
            const progress = ((goal.current_total / goal.end_total) * 100).toFixed(1);
            const endDate = new Date(goal.end_date).toLocaleDateString();
            const daysLeft = Math.ceil((new Date(goal.end_date) - new Date()) / (1000 * 60 * 60 * 24));
            
            context += `- Goal: "${goal.goal_name}". Status: ${user.currency}${goal.current_total} saved towards a ${user.currency}${goal.end_total} target. Progress: ${progress}%. Target date: ${endDate}. Days remaining: ${daysLeft > 0 ? daysLeft : 'Overdue'}.\n`;
        });
    } else {
        context += "The user has no active savings goals.\n";
    }

    if (transactions.length > 0) {
        context += "\nRecent Transactions:\n";
        transactions.forEach(t => {
            const transDate = new Date(t.date).toLocaleDateString();
            context += `- A ${t.type} of ${user.currency}${t.amount} was made for the "${t.Goal.goal_name}" goal on ${transDate}.\n`;
        });
    } else {
        context += "\nThe user has no recent transactions.\n";
    }

    return context;
}

/**
 * Simple AI responder that provides helpful responses based on user data
 * @param {string} userQuery - The question asked by the user.
 * @param {object} userData - An object containing the user, goals, and transactions.
 * @returns {Promise<string>} The AI-generated response.
 */
async function generateResponse(userQuery, userData) {
    try {
        const formattedData = formatUserDataForAI(userData.user, userData.goals, userData.transactions);
        const query = userQuery.toLowerCase();
        
        // Simple keyword-based responses
        if (query.includes('goal') || query.includes('target')) {
            if (userData.goals.length === 0) {
                return "I see you don't have any active savings goals yet! Creating your first savings goal is a great way to start building your financial future. You can add a new goal from your dashboard.";
            }
            
            let response = `You have ${userData.goals.length} active saving goal${userData.goals.length > 1 ? 's' : ''}:\n\n`;
            userData.goals.forEach(goal => {
                const progress = ((goal.current_total / goal.end_total) * 100).toFixed(1);
                const daysLeft = Math.ceil((new Date(goal.end_date) - new Date()) / (1000 * 60 * 60 * 24));
                response += `📌 **${goal.goal_name}**: ${userData.user.currency}${goal.current_total.toLocaleString()} saved (${progress}% of ${userData.user.currency}${goal.end_total.toLocaleString()} target). ${daysLeft > 0 ? `${daysLeft} days remaining` : 'Overdue'}.\n`;
            });
            return response;
        }
        
        if (query.includes('progress') || query.includes('how am i doing')) {
            const totalSaved = userData.user.total_currently_saved || 0;
            const totalTargets = userData.goals.reduce((sum, goal) => sum + goal.end_total, 0);
            const overallProgress = totalTargets > 0 ? ((totalSaved / totalTargets) * 100).toFixed(1) : 0;
            
            return `Great question! Here's your savings overview:\n\n💰 **Total Saved**: ${userData.user.currency}${totalSaved.toLocaleString()}\n🎯 **Overall Progress**: ${overallProgress}% towards your combined goals\n📊 **Active Goals**: ${userData.goals.length}\n\n${userData.goals.length > 0 ? "Keep up the great work! Every small contribution gets you closer to your goals." : "Consider setting your first savings goal to start tracking your progress!"}`;
        }
        
        if (query.includes('transaction') || query.includes('recent') || query.includes('history')) {
            if (userData.transactions.length === 0) {
                return "You haven't made any transactions yet. Once you start saving towards your goals, your transaction history will appear here!";
            }
            
            let response = `Here are your recent transactions:\n\n`;
            userData.transactions.slice(0, 5).forEach(transaction => {
                const date = new Date(transaction.date).toLocaleDateString();
                const type = transaction.type === 'deposit' ? '💰 Deposit' : '💸 Withdrawal';
                response += `${type}: ${userData.user.currency}${transaction.amount} for "${transaction.Goal.goal_name}" on ${date}\n`;
            });
            return response;
        }
        
        if (query.includes('save') || query.includes('saving')) {
            const tips = [
                "Set up automatic transfers to your savings goals to build the habit.",
                "Start small - even saving a few dollars regularly can make a big difference over time.",
                "Track your progress regularly to stay motivated.",
                "Consider the 50/30/20 rule: 50% needs, 30% wants, 20% savings.",
                "Review and adjust your goals as your financial situation changes."
            ];
            const randomTip = tips[Math.floor(Math.random() * tips.length)];
            return `Here's a helpful savings tip: ${randomTip}\n\nBased on your current progress, you're doing well with ${userData.user.currency}${userData.user.total_currently_saved.toLocaleString()} saved across your goals!`;
        }
        
        if (query.includes('help') || query.includes('what can you do')) {
            return `Hi ${userData.user.fname}! I'm Savvy, your savings assistant. I can help you with:\n\n• 📊 Checking your savings progress\n• 🎯 Information about your goals\n• 💸 Reviewing your transaction history\n• 💡 Providing savings tips and motivation\n\nJust ask me questions like:\n- "How are my goals doing?"\n- "Show me my recent transactions"\n- "Give me a savings tip"\n- "What's my progress?"`;
        }
        
        // Default response with personalized information
        const totalSaved = userData.user.total_currently_saved || 0;
        const goalCount = userData.goals.length;
        
        return `Hi ${userData.user.fname}! I'm here to help with your savings journey.\n\nQuick overview:\n💰 Total saved: ${userData.user.currency}${totalSaved.toLocaleString()}\n🎯 Active goals: ${goalCount}\n\nYou can ask me about your goals, progress, transactions, or savings tips. How can I help you today?`;
        
    } catch (error) {
        console.error("Error in AI response generation:", error);
        return "I'm sorry, but I'm having trouble accessing your information right now. Please try again in a moment, or refresh the page if the issue persists.";
    }
}

module.exports = { generateResponse };