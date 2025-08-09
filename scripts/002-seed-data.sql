-- Insert Resources
INSERT INTO resources (name, description) VALUES
  ('users', 'User management and configuration'),
  ('hotspot', 'Hotspot users management'),
  ('pppoe', 'PPPoE users management'),
  ('vouchers', 'Voucher management system'),
  ('profiles', 'Profile management and configuration'),
  ('resellers', 'Reseller management system'),
  ('billing', 'Billing and invoice management'),
  ('finance', 'Financial management system'),
  ('whatsapp', 'WhatsApp integration management'),
  ('reports', 'Reports and analytics'),
  ('monitoring', 'System monitoring and logs'),
  ('settings', 'System settings and configuration'),
  ('roles', 'Role management'),
  ('permissions', 'Permission management'),
  ('schedule', 'Scheduled tasks management'),
  ('notes', 'Notes management'),
  ('dashboard', 'Dashboard access')
ON CONFLICT (name) DO NOTHING;

-- Insert Actions
INSERT INTO actions (name, description) VALUES
  ('view', 'View/read access'),
  ('create', 'Create new records'),
  ('edit', 'Edit existing records'),
  ('delete', 'Delete records'),
  ('generate', 'Generate items (vouchers, etc)'),
  ('manage', 'Full management access'),
  ('bulk_create', 'Bulk creation operations'),
  ('view_orders', 'View orders'),
  ('view_my', 'View own records'),
  ('view_active', 'View active sessions/records'),
  ('view_overview', 'View overview/summary'),
  ('view_bills', 'View bills'),
  ('view_payments', 'View payments'),
  ('view_accounts', 'View accounts'),
  ('view_transactions', 'View transactions'),
  ('view_reports', 'View reports'),
  ('view_budget', 'View budget information'),
  ('view_commissions', 'View commissions'),
  ('view_topup', 'View top-up history'),
  ('view_monthly', 'View monthly records'),
  ('auto_billing', 'Auto billing operations'),
  ('view_logs', 'View system logs')
ON CONFLICT (name) DO NOTHING;

-- Insert Permissions
INSERT INTO permissions (name, description, resource_id, action_id) VALUES
  -- Dashboard
  ('users.view', 'View dashboard', 
   (SELECT id FROM resources WHERE name = 'dashboard'), 
   (SELECT id FROM actions WHERE name = 'view')),
  
  -- Users permissions
  ('users.view', 'View users', 
   (SELECT id FROM resources WHERE name = 'users'), 
   (SELECT id FROM actions WHERE name = 'view')),
  ('users.create', 'Create users', 
   (SELECT id FROM resources WHERE name = 'users'), 
   (SELECT id FROM actions WHERE name = 'create')),
  ('users.hotspot.view', 'View hotspot users', 
   (SELECT id FROM resources WHERE name = 'hotspot'), 
   (SELECT id FROM actions WHERE name = 'view')),
  ('users.pppoe.view', 'View PPPoE users', 
   (SELECT id FROM resources WHERE name = 'pppoe'), 
   (SELECT id FROM actions WHERE name = 'view')),
  
  -- Vouchers permissions
  ('vouchers.view', 'View vouchers', 
   (SELECT id FROM resources WHERE name = 'vouchers'), 
   (SELECT id FROM actions WHERE name = 'view')),
  ('vouchers.orders.view', 'View voucher orders', 
   (SELECT id FROM resources WHERE name = 'vouchers'), 
   (SELECT id FROM actions WHERE name = 'view_orders')),
  ('vouchers.my.view', 'View my vouchers', 
   (SELECT id FROM resources WHERE name = 'vouchers'), 
   (SELECT id FROM actions WHERE name = 'view_my')),
  
  -- Hotspot permissions
  ('hotspot.view', 'View hotspot', 
   (SELECT id FROM resources WHERE name = 'hotspot'), 
   (SELECT id FROM actions WHERE name = 'view')),
  ('hotspot.vouchers.view', 'View hotspot vouchers', 
   (SELECT id FROM resources WHERE name = 'hotspot'), 
   (SELECT id FROM actions WHERE name = 'view')),
  ('hotspot.active.view', 'View active hotspot sessions', 
   (SELECT id FROM resources WHERE name = 'hotspot'), 
   (SELECT id FROM actions WHERE name = 'view_active')),
  ('hotspot.profiles.view', 'View hotspot profiles', 
   (SELECT id FROM resources WHERE name = 'hotspot'), 
   (SELECT id FROM actions WHERE name = 'view')),
  ('hotspot.vouchers.generate', 'Generate hotspot vouchers', 
   (SELECT id FROM resources WHERE name = 'hotspot'), 
   (SELECT id FROM actions WHERE name = 'generate')),
  
  -- PPPoE permissions
  ('pppoe.view', 'View PPPoE', 
   (SELECT id FROM resources WHERE name = 'pppoe'), 
   (SELECT id FROM actions WHERE name = 'view')),
  ('pppoe.users.view', 'View PPPoE users', 
   (SELECT id FROM resources WHERE name = 'pppoe'), 
   (SELECT id FROM actions WHERE name = 'view')),
  ('pppoe.active.view', 'View active PPPoE sessions', 
   (SELECT id FROM resources WHERE name = 'pppoe'), 
   (SELECT id FROM actions WHERE name = 'view_active')),
  ('pppoe.profiles.view', 'View PPPoE profiles', 
   (SELECT id FROM resources WHERE name = 'pppoe'), 
   (SELECT id FROM actions WHERE name = 'view')),
  
  -- Profiles permissions
  ('profiles.view', 'View profiles', 
   (SELECT id FROM resources WHERE name = 'profiles'), 
   (SELECT id FROM actions WHERE name = 'view')),
  
  -- Resellers permissions
  ('resellers.view', 'View resellers', 
   (SELECT id FROM resources WHERE name = 'resellers'), 
   (SELECT id FROM actions WHERE name = 'view')),
  
  -- Billing permissions
  ('billing.view', 'View billing', 
   (SELECT id FROM resources WHERE name = 'billing'), 
   (SELECT id FROM actions WHERE name = 'view')),
  ('billing.edit', 'Edit billing records', 
   (SELECT id FROM resources WHERE name = 'billing'), 
   (SELECT id FROM actions WHERE name = 'edit')),
  
  -- Finance permissions
  ('finance.view', 'View finance', 
   (SELECT id FROM resources WHERE name = 'finance'), 
   (SELECT id FROM actions WHERE name = 'view')),
  ('finance.overview.view', 'View finance overview', 
   (SELECT id FROM resources WHERE name = 'finance'), 
   (SELECT id FROM actions WHERE name = 'view_overview')),
  ('finance.bills.view', 'View finance bills', 
   (SELECT id FROM resources WHERE name = 'finance'), 
   (SELECT id FROM actions WHERE name = 'view_bills')),
  ('finance.payments.view', 'View finance payments', 
   (SELECT id FROM resources WHERE name = 'finance'), 
   (SELECT id FROM actions WHERE name = 'view_payments')),
  ('finance.accounts.view', 'View finance accounts', 
   (SELECT id FROM resources WHERE name = 'finance'), 
   (SELECT id FROM actions WHERE name = 'view_accounts')),
  ('finance.transactions.view', 'View finance transactions', 
   (SELECT id FROM resources WHERE name = 'finance'), 
   (SELECT id FROM actions WHERE name = 'view_transactions')),
  ('finance.reports.view', 'View finance reports', 
   (SELECT id FROM resources WHERE name = 'finance'), 
   (SELECT id FROM actions WHERE name = 'view_reports')),
  ('finance.budget.view', 'View finance budget', 
   (SELECT id FROM resources WHERE name = 'finance'), 
   (SELECT id FROM actions WHERE name = 'view_budget')),
  
  -- WhatsApp permissions
  ('whatsapp.view', 'View WhatsApp', 
   (SELECT id FROM resources WHERE name = 'whatsapp'), 
   (SELECT id FROM actions WHERE name = 'view')),
  
  -- Reports permissions
  ('reports.view', 'View reports', 
   (SELECT id FROM resources WHERE name = 'reports'), 
   (SELECT id FROM actions WHERE name = 'view')),
  
  -- Monitoring permissions
  ('monitoring.view', 'View monitoring', 
   (SELECT id FROM resources WHERE name = 'monitoring'), 
   (SELECT id FROM actions WHERE name = 'view')),
  ('monitoring.logs', 'View system logs', 
   (SELECT id FROM resources WHERE name = 'monitoring'), 
   (SELECT id FROM actions WHERE name = 'view_logs')),
  
  -- Settings permissions
  ('settings.view', 'View settings', 
   (SELECT id FROM resources WHERE name = 'settings'), 
   (SELECT id FROM actions WHERE name = 'view')),
  
  -- Roles permissions
  ('roles.view', 'View roles', 
   (SELECT id FROM resources WHERE name = 'roles'), 
   (SELECT id FROM actions WHERE name = 'view')),
  
  -- Permissions permissions
  ('permissions.view', 'View permissions', 
   (SELECT id FROM resources WHERE name = 'permissions'), 
   (SELECT id FROM actions WHERE name = 'view'))
ON CONFLICT (name) DO NOTHING;

-- Create roles if they don't exist (assuming roles table exists)
INSERT INTO roles (name, description) VALUES
  ('admin', 'Administrator with full access'),
  ('manager', 'Manager with limited administrative access'),
  ('operator', 'Operator with operational access'),
  ('viewer', 'Read-only access'),
  ('reseller', 'Reseller with specific permissions')
ON CONFLICT (name) DO NOTHING;

-- Replace approach: Delete existing then insert new permissions

-- Replace admin role permissions
DELETE FROM role_permissions WHERE role_id = (SELECT id FROM roles WHERE name = 'admin');
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'admin';

-- Replace viewer role permissions  
DELETE FROM role_permissions WHERE role_id = (SELECT id FROM roles WHERE name = 'viewer');
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
JOIN actions a ON p.action_id = a.id
WHERE r.name = 'viewer' 
AND a.name = 'view';

-- Replace reseller role permissions
DELETE FROM role_permissions WHERE role_id = (SELECT id FROM roles WHERE name = 'reseller');
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'reseller' 
AND p.name IN (
  'vouchers.view', 'vouchers.orders.view', 'vouchers.my.view',
  'hotspot.vouchers.view', 'hotspot.vouchers.generate',
  'resellers.view', 'billing.view', 'reports.view',
  'users.view'
);