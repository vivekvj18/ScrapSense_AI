CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  user_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_code text UNIQUE NOT NULL,
  full_name text NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('EMPLOYEE','MANAGER')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE material_types (
  material_type_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  type_code text UNIQUE NOT NULL,
  type_name text NOT NULL,
  inspection_config jsonb NOT NULL DEFAULT '{}',
  config_version int NOT NULL DEFAULT 1
);

CREATE TABLE materials (
  material_id text PRIMARY KEY,
  material_type_id uuid NOT NULL REFERENCES material_types(material_type_id),
  product_number text NOT NULL,
  material_name text NOT NULL,
  location text NOT NULL,
  unit text NOT NULL DEFAULT 'unit',
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  UNIQUE (material_id, product_number)
);

CREATE TABLE stock_balances (
  material_id text PRIMARY KEY REFERENCES materials(material_id),
  available_qty int NOT NULL CHECK (available_qty >= 0),
  repair_qty int NOT NULL DEFAULT 0 CHECK (repair_qty >= 0),
  scrapped_qty int NOT NULL DEFAULT 0 CHECK (scrapped_qty >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inspection_requests (
  request_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_number text UNIQUE NOT NULL,
  employee_id uuid NOT NULL REFERENCES users(user_id),
  material_id text NOT NULL REFERENCES materials(material_id),
  quantity int NOT NULL CHECK (quantity > 0),
  location text NOT NULL,
  reported_reason text NOT NULL,
  employee_comments text,
  status text NOT NULL,
  final_disposition text,
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inspection_requests_employee ON inspection_requests(employee_id);
CREATE INDEX idx_inspection_requests_status ON inspection_requests(status);

CREATE TABLE request_images (
  image_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id uuid NOT NULL REFERENCES inspection_requests(request_id) ON DELETE CASCADE,
  image_kind text NOT NULL,
  storage_key text NOT NULL,
  mime_type text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES users(user_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inspection_reports (
  report_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id uuid NOT NULL REFERENCES inspection_requests(request_id) ON DELETE CASCADE,
  report_version int NOT NULL,
  analysis_mode text NOT NULL,
  damage_score numeric(5,2),
  material_match_score numeric(5,2),
  reason_consistency_score numeric(5,2),
  composite_score numeric(5,2),
  raw_classification text,
  effective_recommendation text,
  damage_analysis jsonb NOT NULL,
  material_validation jsonb NOT NULL,
  reason_consistency jsonb NOT NULL,
  hard_gates jsonb NOT NULL DEFAULT '[]',
  warnings jsonb NOT NULL DEFAULT '[]',
  summary text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(request_id, report_version)
);

CREATE TABLE defect_findings (
  finding_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id uuid NOT NULL REFERENCES inspection_reports(report_id) ON DELETE CASCADE,
  defect_type text NOT NULL,
  severity numeric(5,2),
  observation text NOT NULL,
  bounding_box jsonb
);

CREATE TABLE manager_decisions (
  decision_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id uuid NOT NULL UNIQUE REFERENCES inspection_requests(request_id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES inspection_reports(report_id),
  manager_id uuid NOT NULL REFERENCES users(user_id),
  decision text NOT NULL,
  disposition text,
  remarks text,
  override_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE handling_tasks (
  task_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id uuid NOT NULL UNIQUE REFERENCES inspection_requests(request_id) ON DELETE CASCADE,
  action text NOT NULL,
  status text NOT NULL,
  employee_confirmed_at timestamptz,
  manager_verified_at timestamptz,
  verified_by uuid REFERENCES users(user_id)
);

CREATE TABLE stock_movements (
  movement_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  handling_task_id uuid NOT NULL UNIQUE REFERENCES handling_tasks(task_id),
  request_id uuid NOT NULL REFERENCES inspection_requests(request_id),
  material_id text NOT NULL REFERENCES materials(material_id),
  movement_type text NOT NULL,
  quantity int NOT NULL CHECK (quantity > 0),
  available_before int NOT NULL,
  available_after int NOT NULL,
  authorized_by uuid NOT NULL REFERENCES users(user_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  notification_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(user_id),
  request_id uuid REFERENCES inspection_requests(request_id),
  message text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  audit_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id uuid REFERENCES users(user_id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
