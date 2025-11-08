const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const db = new sqlite3.Database('./db.sqlite');

bcrypt.hash('admin123', 10, (err, adminHash) => {
  bcrypt.hash('user123', 10, (err, userHash) => {
    db.serialize(() => {
      db.run(`DELETE FROM users`);
      db.run(`DELETE FROM credits`);
      db.run(`DELETE FROM pending_transfers`);

      db.run(`INSERT INTO users (email, password, name, is_admin) VALUES 
        ('admin@columbusbank.edu', '${adminHash}', 'Admin', 1),
        ('alice@columbusbank.edu', '${userHash}', 'Alice Johnson', 0),
        ('bob@columbusbank.edu', '${userHash}', 'Bob Smith', 0)`);

      console.log('Columbus District Bank seeded!');
      console.log('Admin: admin@columbusbank.edu / admin123');
      console.log('Users: alice@columbusbank.edu / user123');
    });
    db.close();
  });
});
