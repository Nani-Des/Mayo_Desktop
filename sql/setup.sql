CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    id_card TEXT NOT NULL UNIQUE,
    role TEXT
);

INSERT INTO users (name, id_card, role)
VALUES
('Dr.Nana Kweku', 'D21035633', 'doctor'),
('Nurse Kofi Owusu', 'N5678', 'nurse');
