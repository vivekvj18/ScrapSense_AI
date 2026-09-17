import bcrypt from 'bcryptjs';
import { pool } from '../src/database/pool.js';

async function seed() {
  const employeeHash = await bcrypt.hash('employee123', 10);
  const managerHash = await bcrypt.hash('manager123', 10);
  await pool.query(
    `INSERT INTO users (employee_code, full_name, email, password_hash, role)
     VALUES
       ('EMP-100','Anika Patel','employee@scrapsense.local',$1,'EMPLOYEE'),
       ('MGR-100','Rohan Mehta','manager@scrapsense.local',$2,'MANAGER')
     ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash`,
    [employeeHash, managerHash]
  );
  const type = await pool.query(
    `INSERT INTO material_types (type_code, type_name, inspection_config, config_version)
     VALUES ('PCB','Printed Circuit Board',$1,1)
     ON CONFLICT (type_code) DO UPDATE SET inspection_config=EXCLUDED.inspection_config
     RETURNING material_type_id`,
    [JSON.stringify({
      supportedDefects: ['burn_mark', 'crack', 'surface_scratch', 'broken_trace', 'missing_component', 'bent_component', 'discoloration'],
      exactIdentityRequired: false,
      referenceImages: [
        'reference/pcb-demo-01-placeholder.jpg',
        'reference/pcb-demo-02-placeholder.jpg',
        'reference/pcb-demo-03-placeholder.jpg',
        'reference/pcb-demo-04-placeholder.jpg',
        'reference/pcb-demo-05-placeholder.jpg',
        'reference/pcb-demo-06-placeholder.jpg',
        'reference/pcb-demo-07-placeholder.jpg',
        'reference/pcb-demo-08-placeholder.jpg',
        'reference/pcb-demo-09-placeholder.jpg',
        'reference/pcb-demo-10-placeholder.jpg'
      ]
    })]
  );
  await pool.query(
    `INSERT INTO materials (material_id, material_type_id, product_number, material_name, location, unit, unit_cost)
     VALUES
       ('MAT-1001',$1,'PCB-A101','Industrial Control PCB','Warehouse A','unit',42.50),
       ('MAT-1002',$1,'PCB-B204','Power Regulation PCB','Warehouse B','unit',55.00)
     ON CONFLICT (material_id) DO UPDATE SET material_name=EXCLUDED.material_name`,
    [type.rows[0].material_type_id]
  );
  await pool.query(
    `INSERT INTO stock_balances (material_id, available_qty, repair_qty, scrapped_qty)
     VALUES ('MAT-1001',25,0,0), ('MAT-1002',12,0,0)
     ON CONFLICT (material_id) DO UPDATE SET available_qty=EXCLUDED.available_qty`
  );
  await pool.end();
  console.log('Seeded ScrapSense AI demo data.');
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
