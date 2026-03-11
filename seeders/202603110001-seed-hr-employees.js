'use strict';

const { Op } = require('sequelize');

module.exports = {

async up(queryInterface) {

const now = new Date();

/* ───────────────── Fetch Departments ───────────────── */

const [depts] = await queryInterface.sequelize.query(
`SELECT id, code FROM departments`
);

const deptMap = {};
depts.forEach(d => deptMap[d.code] = d.id);

/* ───────────────── Fetch Roles ───────────────── */

const [roles] = await queryInterface.sequelize.query(
`SELECT id, name FROM roles WHERE name IN ('admin','manager','employee')`
);

const roleMap = {};
roles.forEach(r => roleMap[r.name] = r.id);

/* ───────────────── Insert Employees ───────────────── */

const employees = [

/* ADMIN */

{
employee_number:'PINT099',
first_name:'Tanishq',
last_name:'Yadav',
email:'tyadav@parkar.in',
department_id:deptMap['DE'],
manager_id:null,
job_title:'Admin',
band_identifier:'L5',
is_active:true,
password_hash:null,
created_at:now,
updated_at:now
},

/* LEVEL 1 */

{
employee_number:'PINT096',
first_name:'Ayush',
last_name:'Singh',
email:'asingh4@parkar.in',
department_id:deptMap['DE'],
manager_id:null,
job_title:'Engineering Manager',
band_identifier:'L4',
is_active:true,
password_hash:null,
created_at:now,
updated_at:now
},

/* LEVEL 2 */

{
employee_number:'PINT091',
first_name:'Bhanu',
last_name:'Choudhary',
email:'bchoudhary@parkar.in',
department_id:deptMap['SE'],
manager_id:null,
job_title:'Team Lead',
band_identifier:'L3',
is_active:true,
password_hash:null,
created_at:now,
updated_at:now
},

/* LEVEL 3 */

{
employee_number:'EMP100',
first_name:'Kunal',
last_name:'Choudhary',
email:'kchaudhary@parkar.in',
department_id:deptMap['SE'],
manager_id:null,
job_title:'Senior Developer',
band_identifier:'L3',
is_active:true,
password_hash:null,
created_at:now,
updated_at:now
},

/* AYUSH TEAM */

{ employee_number:'EMP101',first_name:'Rohit',last_name:'Verma',email:'rohit@parkar.in',department_id:deptMap['DE'],manager_id:null,job_title:'Developer',band_identifier:'L1',is_active:true,password_hash:null,created_at:now,updated_at:now },
{ employee_number:'EMP102',first_name:'Neha',last_name:'Kapoor',email:'neha@parkar.in',department_id:deptMap['DE'],manager_id:null,job_title:'Developer',band_identifier:'L1',is_active:true,password_hash:null,created_at:now,updated_at:now },
{ employee_number:'EMP103',first_name:'Arjun',last_name:'Mehta',email:'arjun@parkar.in',department_id:deptMap['DE'],manager_id:null,job_title:'Developer',band_identifier:'L1',is_active:true,password_hash:null,created_at:now,updated_at:now },
{ employee_number:'EMP104',first_name:'Priya',last_name:'Sharma',email:'priya@parkar.in',department_id:deptMap['DE'],manager_id:null,job_title:'QA',band_identifier:'L1',is_active:true,password_hash:null,created_at:now,updated_at:now },
{ employee_number:'EMP105',first_name:'Karan',last_name:'Shah',email:'karan@parkar.in',department_id:deptMap['DE'],manager_id:null,job_title:'DevOps',band_identifier:'L1',is_active:true,password_hash:null,created_at:now,updated_at:now },

/* BHANU TEAM */

{ employee_number:'EMP106',first_name:'Riya',last_name:'Patel',email:'riya@parkar.in',department_id:deptMap['SE'],manager_id:null,job_title:'Analyst',band_identifier:'L1',is_active:true,password_hash:null,created_at:now,updated_at:now },
{ employee_number:'EMP107',first_name:'Aditya',last_name:'Joshi',email:'aditya@parkar.in',department_id:deptMap['SE'],manager_id:null,job_title:'Developer',band_identifier:'L1',is_active:true,password_hash:null,created_at:now,updated_at:now },
{ employee_number:'EMP108',first_name:'Simran',last_name:'Kaur',email:'simran@parkar.in',department_id:deptMap['SE'],manager_id:null,job_title:'Designer',band_identifier:'L1',is_active:true,password_hash:null,created_at:now,updated_at:now },
{ employee_number:'EMP109',first_name:'Nikhil',last_name:'Agarwal',email:'nikhil@parkar.in',department_id:deptMap['SE'],manager_id:null,job_title:'Developer',band_identifier:'L1',is_active:true,password_hash:null,created_at:now,updated_at:now },
{ employee_number:'EMP110',first_name:'Ananya',last_name:'Gupta',email:'ananya@parkar.in',department_id:deptMap['SE'],manager_id:null,job_title:'QA',band_identifier:'L1',is_active:true,password_hash:null,created_at:now,updated_at:now },

/* KUNAL TEAM */

{ employee_number:'EMP111',first_name:'Varun',last_name:'Malhotra',email:'varun@parkar.in',department_id:deptMap['SE'],manager_id:null,job_title:'Developer',band_identifier:'L1',is_active:true,password_hash:null,created_at:now,updated_at:now },
{ employee_number:'EMP112',first_name:'Pooja',last_name:'Nair',email:'pooja@parkar.in',department_id:deptMap['SE'],manager_id:null,job_title:'Analyst',band_identifier:'L1',is_active:true,password_hash:null,created_at:now,updated_at:now },
{ employee_number:'EMP113',first_name:'Amit',last_name:'Sharma',email:'amit@parkar.in',department_id:deptMap['SE'],manager_id:null,job_title:'Engineer',band_identifier:'L1',is_active:true,password_hash:null,created_at:now,updated_at:now },
{ employee_number:'EMP114',first_name:'Sneha',last_name:'Iyer',email:'sneha@parkar.in',department_id:deptMap['SE'],manager_id:null,job_title:'Engineer',band_identifier:'L1',is_active:true,password_hash:null,created_at:now,updated_at:now },
{ employee_number:'EMP115',first_name:'Rahul',last_name:'Saxena',email:'rahul@parkar.in',department_id:deptMap['SE'],manager_id:null,job_title:'Engineer',band_identifier:'L1',is_active:true,password_hash:null,created_at:now,updated_at:now }

];

await queryInterface.bulkInsert('employees', employees);

/* ───────────────── Map employee_number → id ───────────────── */

const [rows] = await queryInterface.sequelize.query(
`SELECT id, employee_number FROM employees`
);

const empMap = {};
rows.forEach(e => empMap[e.employee_number] = e.id);

/* ───────────────── Manager Relationships ───────────────── */

const relations = [

{ emp:'PINT091', manager:'PINT096' },
{ emp:'EMP100', manager:'PINT091' },

{ emp:'EMP101', manager:'PINT096' },
{ emp:'EMP102', manager:'PINT096' },
{ emp:'EMP103', manager:'PINT096' },
{ emp:'EMP104', manager:'PINT096' },
{ emp:'EMP105', manager:'PINT096' },

{ emp:'EMP106', manager:'PINT091' },
{ emp:'EMP107', manager:'PINT091' },
{ emp:'EMP108', manager:'PINT091' },
{ emp:'EMP109', manager:'PINT091' },
{ emp:'EMP110', manager:'PINT091' },

{ emp:'EMP111', manager:'EMP100' },
{ emp:'EMP112', manager:'EMP100' },
{ emp:'EMP113', manager:'EMP100' },
{ emp:'EMP114', manager:'EMP100' },
{ emp:'EMP115', manager:'EMP100' }

];

for (const r of relations) {

await queryInterface.bulkUpdate(
'employees',
{ manager_id: empMap[r.manager] },
{ employee_number: r.emp }
);

}

/* ───────────────── Detect Managers ───────────────── */

const [managers] = await queryInterface.sequelize.query(
`SELECT DISTINCT manager_id FROM employees WHERE manager_id IS NOT NULL`
);

const managerIds = managers.map(m => m.manager_id);

/* ───────────────── Assign Roles ───────────────── */

const employeeRoles = [];

rows.forEach(e => {

let role = 'employee';

if (e.employee_number === 'PINT099') role = 'admin';
else if (managerIds.includes(e.id)) role = 'manager';

employeeRoles.push({
employee_id: e.id,
role_id: roleMap[role],
is_primary:true,
assigned_at:now
});

});

await queryInterface.bulkInsert('employee_roles', employeeRoles);

},

async down(queryInterface) {

await queryInterface.bulkDelete('employee_roles', null, {});
await queryInterface.bulkDelete('employees', {
employee_number:{
[Op.in]:[
'PINT099','PINT096','PINT091','EMP100',
'EMP101','EMP102','EMP103','EMP104','EMP105',
'EMP106','EMP107','EMP108','EMP109','EMP110',
'EMP111','EMP112','EMP113','EMP114','EMP115'
]
}
});

}

};