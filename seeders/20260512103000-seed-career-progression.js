'use strict';

const departmentData = {
  'Data Engineering': [
    {
      role: 'Data Engineer',
      steps: [
        'GTE',
        'Data Engineer',
        'Senior Data Engineer',
        'Lead Data Engineer/Associate Data Architect',
        'Data Architect',
        'Senior Data Architect',
        'Principle Data Architect'
      ]
    },
    {
      role: 'Data Scientist / AI Engineer',
      steps: [
        'GTE',
        'Data Scientist / AI Engineer',
        'Senior AI Engineer',
        'Lead AI Engineer'
      ]
    },
    {
      role: 'Data Architect',
      steps: [
        'GTE',
        'Associate Data Architect',
        'Data Architect',
        'Senior Data Architect',
        'Principal Data Architect'
      ]
    },
    {
      role: 'DataOps Engineer',
      steps: [
        'GTE',
        'DataOps Engineer',
        'Senior DataOps Engineer',
        'Lead DataOps Engineer'
      ]
    },
    {
      role: 'MLOps Engineer',
      steps: [
        'GTE',
        'MLOps Engineer',
        'Senior MLOps Engineer',
        'Lead MLOps Engineer'
      ]
    },
    {
      role: 'Data QA Engineer',
      steps: [
        'GTE',
        'Data QA Engineer',
        'Senior Data QA Engineer',
        'Lead Data QA Engineer'
      ]
    },
    {
      role: 'Data Steward',
      steps: [
        'GTE',
        'Data Steward',
        'Senior Data Steward'
      ]
    },
    {
      role: 'Data Governance Lead',
      steps: [
        'GTE',
        'Data Governance Lead',
        'Senior Data Governance Lead'
      ]
    },
    {
      role: 'Data Security Engineer',
      steps: [
        'GTE',
        'Data Security Engineer',
        'Senior Data Security Engineer',
        'Lead Data Security Engineer'
      ]
    },
    {
      role: 'Data Analyst',
      steps: [
        'GTE',
        'Junior Data Analyst',
        'Data Analyst',
        'Senior Data Analyst',
        'Lead Data Analyst'
      ]
    },
    {
      role: 'BI Engineer',
      steps: [
        'GTE',
        'BI Engineer',
        'Senior BI Engineer',
        'BI Architect',
        'Principal BI Architect'
      ]
    },
    {
      role: 'Business Analyst',
      steps: [
        'GTE',
        'Business Analyst',
        'Senior Business Analyst'
      ]
    },
    {
      role: 'Scrum Master',
      steps: [
        'GTE',
        'Scrum Master',
        'Senior Scrum Master'
      ]
    },
    {
      role: 'Product Owner',
      steps: [
        'Product Owner',
        'Senior Product Owner'
      ]
    }
  ],

  'Application Development': [
    {
      role: 'Application Developer',
      steps: [
        'GTE',
        'Application Developer',
        'Senior Application Developer',
        'Technical Lead',
        'Application/Solution Architect'
      ]
    },
    {
      role: 'QA Automation Engineer',
      steps: [
        'GTE',
        'QA Automation Engineer',
        'Senior QA Engineer',
        'Lead QA Engineer'
      ]
    },
    {
      role: 'Scrum Master',
      steps: [
        'Scrum Master',
        'Sr Scrum Master',
        'Lead Scrum Master'
      ]
    },
    {
      role: 'Product Owner',
      steps: [
        'Product Owner',
        'Sr Product Owner'
      ]
    },
    {
      role: 'Cloud Admin',
      steps: [
        'Cloud Admin',
        'Sr Cloud Admin',
        'Lead Cloud Admin',
        'Cloud Solution Architect'
      ]
    },
    {
      role: 'DevOps Engineer',
      steps: [
        'GTE',
        'DevOps Engineer',
        'Senior DevOps Engineer',
        'Lead DevOps Engineer'
      ]
    },
    {
      role: 'SRE Engineer',
      steps: [
        'GTE',
        'SRE Engineer',
        'Senior SRE Engineer',
        'Lead SRE Engineer'
      ]
    }
  ],

  'MSP / Infrastructure': [
    {
      role: 'Network Operations Engineer',
      steps: [
        'GTE',
        'Monitoring Analyst',
        'Network Operations Engineer',
        'Network Security Engineer',
        'Network Architect'
      ]
    },
    {
      role: 'Cloud Operations Engineer',
      steps: [
        'GTE',
        'Monitoring Analyst',
        'Cloud Operations Engineer',
        'SRE Engineer',
        'Principal Platform Architect'
      ]
    },
    {
      role: 'Security Operations Engineer',
      steps: [
        'GTE',
        'Monitoring Analyst',
        'Security Operations Engineer',
        'Cyber Security Specialist',
        'Cyber Tech Lead'
      ]
    },
    {
      role: 'Security Operations Engineer (InfoSec Track)',
      steps: [
        'GTE',
        'Monitoring Analyst',
        'Security Operations Engineer',
        'InfoSec Specialist',
        'AI Security Engineer'
      ]
    },
    {
      role: 'Service Desk Engineer',
      steps: [
        'GTE',
        'Monitoring Analyst',
        'Service Desk Engineer',
        'Quality Assurance Automation Engineer'
      ]
    },
    {
      role: 'Application Support Engineer',
      steps: [
        'GTE',
        'Monitoring Analyst',
        'Application Support Engineer'
      ]
    },
    {
      role: 'Data Operations Engineer (Infra)',
      steps: [
        'GTE',
        'Monitoring Analyst',
        'Data Operations Engineer',
        'Senior Data Operations Engineer',
        'ML Ops Engineer',
        'LLMOps Engineer'
      ]
    }
  ]
};

/**
 * Seeder: Inserts departments, ideal_roles and career_paths.
 * - Uses transactions
 * - Attempts idempotency by checking existing rows
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const now = new Date();

      const deptNames = Object.keys(departmentData);

      // Fetch existing departments by name
      const [existingDepts] = await queryInterface.sequelize.query(
        `SELECT id, name FROM departments WHERE name IN (${deptNames.map(() => '?').join(',')})`,
        { replacements: deptNames, transaction }
      );

      const deptMap = {};
      existingDepts.forEach((d) => { deptMap[d.name] = d.id; });

      // Insert missing departments
      const missingDepts = deptNames.filter((n) => !deptMap[n]);
      if (missingDepts.length) {
        const toInsert = missingDepts.map((name) => ({ name, created_at: now, updated_at: now }));
        await queryInterface.bulkInsert('departments', toInsert, { transaction });

        const [newDepts] = await queryInterface.sequelize.query(
          `SELECT id, name FROM departments WHERE name IN (${missingDepts.map(() => '?').join(',')})`,
          { replacements: missingDepts, transaction }
        );
        newDepts.forEach((d) => { deptMap[d.name] = d.id; });
      }

      // Prepare ideal_roles insertions per department
      const idealRolesToInsert = [];
      const rolePairs = []; // [{ department_name, role_name }]

      for (const [deptName, roles] of Object.entries(departmentData)) {
        const department_id = deptMap[deptName];
        roles.forEach((r) => {
          rolePairs.push({ department_name: deptName, role_name: r.role });
        });
      }

      // Fetch existing ideal_roles for these departments
      const deptIds = Array.from(new Set(Object.values(deptMap)));
      let existingIdealRoles = [];
      if (deptIds.length) {
        const [rows] = await queryInterface.sequelize.query(
          `SELECT id AS ideal_role_id, role_name, department_id FROM ideal_roles WHERE department_id IN (${deptIds.map(() => '?').join(',')})`,
          { replacements: deptIds, transaction }
        );
        existingIdealRoles = rows;
      }

      const idealRoleMap = {};// key: `${department_id}||${role_name}` -> id
      existingIdealRoles.forEach((ir) => {
        idealRoleMap[`${ir.department_id}||${ir.role_name}`] = ir.ideal_role_id;
      });

      // Build missing ideal_roles
      for (const [deptName, roles] of Object.entries(departmentData)) {
        const department_id = deptMap[deptName];
        for (const r of roles) {
          const key = `${department_id}||${r.role}`;
          if (!idealRoleMap[key]) {
            idealRolesToInsert.push({ department_id, role_name: r.role, created_at: now, updated_at: now });
          }
        }
      }

      if (idealRolesToInsert.length) {
        await queryInterface.bulkInsert('ideal_roles', idealRolesToInsert, { transaction });

        // Refresh map
        if (deptIds.length) {
          const [allIdealRoles] = await queryInterface.sequelize.query(
            `SELECT id AS ideal_role_id, role_name, department_id FROM ideal_roles WHERE department_id IN (${deptIds.map(() => '?').join(',')})`,
            { replacements: deptIds, transaction }
          );
          allIdealRoles.forEach((ir) => { idealRoleMap[`${ir.department_id}||${ir.role_name}`] = ir.ideal_role_id; });
        }
      }

      // Prepare career_paths inserts, ensuring no duplicates
      const idealRoleIds = Object.values(idealRoleMap);
      let existingCareerPaths = [];
      if (idealRoleIds.length) {
        const [rows] = await queryInterface.sequelize.query(
          `SELECT id AS career_path_id, ideal_role_id, step_order FROM career_paths WHERE ideal_role_id IN (${idealRoleIds.map(() => '?').join(',')})`,
          { replacements: idealRoleIds, transaction }
        );
        existingCareerPaths = rows;
      }

      const careerPathMap = {};// key: `${ideal_role_id}||${step_order}` -> id
      existingCareerPaths.forEach((cp) => { careerPathMap[`${cp.ideal_role_id}||${cp.step_order}`] = cp.career_path_id; });

      const careerPathsToInsert = [];

      for (const [deptName, roles] of Object.entries(departmentData)) {
        const department_id = deptMap[deptName];
        for (const r of roles) {
          const ideal_role_id = idealRoleMap[`${department_id}||${r.role}`];
          if (!ideal_role_id) continue;
          for (let i = 0; i < r.steps.length; i++) {
            const step_order = i + 1;
            const key = `${ideal_role_id}||${step_order}`;
            if (!careerPathMap[key]) {
              careerPathsToInsert.push({ ideal_role_id, step_order, role_title: r.steps[i], created_at: now, updated_at: now });
            }
          }
        }
      }

      if (careerPathsToInsert.length) {
        await queryInterface.bulkInsert('career_paths', careerPathsToInsert, { transaction });
      }

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const Op = Sequelize.Op;
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const deptNames = Object.keys(departmentData);

      // Find departments by name
      const [depts] = await queryInterface.sequelize.query(
        `SELECT id, name FROM departments WHERE name IN (${deptNames.map(() => '?').join(',')})`,
        { replacements: deptNames, transaction }
      );
      const deptMap = {};
      depts.forEach((d) => { deptMap[d.name] = d.id; });
      const deptIds = Object.values(deptMap);

      if (deptIds.length) {
        // Find ideal_roles for those departments
        const [idealRoles] = await queryInterface.sequelize.query(
            `SELECT id AS ideal_role_id, role_name, department_id FROM ideal_roles WHERE department_id IN (${deptIds.map(() => '?').join(',')})`,
            { replacements: deptIds, transaction }
          );

          const idealRoleIds = idealRoles.map((r) => r.ideal_role_id);

        if (idealRoleIds.length) {
          // Delete career_paths first
          await queryInterface.bulkDelete('career_paths', {
            ideal_role_id: { [Op.in]: idealRoleIds }
          }, { transaction });

          // Delete ideal_roles
          await queryInterface.bulkDelete('ideal_roles', {
            id: { [Op.in]: idealRoleIds }
          }, { transaction });
        }

        // Delete departments (only those exact names)
        await queryInterface.bulkDelete('departments', {
          name: { [Op.in]: deptNames }
        }, { transaction });
      }

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
