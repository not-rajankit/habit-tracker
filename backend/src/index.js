import app from './app.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Habit Tracker API running on http://localhost:${PORT}`);
});
