-- Create default admin user (password: admin123)
-- Password hash for 'admin123' using bcrypt
INSERT INTO users (email, username, password, name) VALUES
  ('admin@example.com', 'admin', '$2b$10$rOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqu', 'Administrator')
ON CONFLICT (email) DO NOTHING;

-- Create default user (password: user123)
-- Password hash for 'user123' using bcrypt
INSERT INTO users (email, username, password, name) VALUES
  ('user@example.com', 'user', '$2b$10$rOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqu', 'Regular User')
ON CONFLICT (email) DO NOTHING;

-- Assign admin role to admin user
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.username = 'admin' AND r.name = 'admin'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Assign user role to regular user
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.username = 'user' AND r.name = 'user'
ON CONFLICT (user_id, role_id) DO NOTHING;
