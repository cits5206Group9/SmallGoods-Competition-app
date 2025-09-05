import sqlite3  
import os  
  
db_path = "src/instance/smallgoods_dev.db"  
if not os.path.exists(db_path):  
    db_path = "instance/smallgoods_dev.db"  
  
print(f"Using database: {db_path}")  
conn = sqlite3.connect(db_path)  
cursor = conn.cursor() 
try:  
    cursor.execute("ALTER TABLE competition ADD COLUMN sport_type VARCHAR(50)")  
    print("Added sport_type column")  
except:  
    print("sport_type column already exists or error") 
try:  
    cursor.execute("ALTER TABLE competition ADD COLUMN location VARCHAR(200)")  
    cursor.execute("ALTER TABLE competition ADD COLUMN start_date DATE")  
    print("Added competition columns")  
except:  
    print("Competition columns error") 
cursor.execute("UPDATE competition SET sport_type = 'powerlifting' WHERE sport_type IS NULL")  
cursor.execute("UPDATE competition SET location = 'TBD' WHERE location IS NULL")  
cursor.execute("UPDATE competition SET start_date = date WHERE start_date IS NULL")  
conn.commit()  
conn.close()  
print("Database fix completed!") 
