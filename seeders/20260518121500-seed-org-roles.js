'use strict';

// Seeder: populate org_roles with unique role names from departmentData

const departmentData = [
  'GTE',

  // Data Engineering
  'Data Engineer',
  'Senior Data Engineer',
  'Lead Data Engineer/Associate Data Architect',
  'Data Architect',
  'Senior Data Architect',
  'Principle Data Architect',

  'Data Scientist / AI Engineer',
  'Senior AI Engineer',
  'Lead AI Engineer',

  'Associate Data Architect',
  'Principal Data Architect',

  'DataOps Engineer',
  'Senior DataOps Engineer',
  'Lead DataOps Engineer',

  'MLOps Engineer',
  'Senior MLOps Engineer',
  'Lead MLOps Engineer',

  'Data QA Engineer',
  'Senior Data QA Engineer',
  'Lead Data QA Engineer',

  'Data Steward',
  'Senior Data Steward',

  'Data Governance Lead',
  'Senior Data Governance Lead',

  'Data Security Engineer',
  'Senior Data Security Engineer',
  'Lead Data Security Engineer',

  'Junior Data Analyst',
  'Data Analyst',
  'Senior Data Analyst',
  'Lead Data Analyst',

  'BI Engineer',
  'Senior BI Engineer',
  'BI Architect',
  'Principal BI Architect',

  'Business Analyst',
  'Senior Business Analyst',

  'Scrum Master',
  'Senior Scrum Master',

  'Product Owner',
  'Senior Product Owner',

  // Application Development
  'Application Developer',
  'Senior Application Developer',
  'Technical Lead',
  'Application/Solution Architect',

  'QA Automation Engineer',
  'Senior QA Engineer',
  'Lead QA Engineer',

  'Sr Scrum Master',
  'Lead Scrum Master',

  'Sr Product Owner',

  'Cloud Admin',
  'Sr Cloud Admin',
  'Lead Cloud Admin',
  'Cloud Solution Architect',

  'DevOps Engineer',
  'Senior DevOps Engineer',
  'Lead DevOps Engineer',

  'SRE Engineer',
  'Senior SRE Engineer',
  'Lead SRE Engineer',

  // MSP / Infrastructure
  'Monitoring Analyst',

  'Network Operations Engineer',
  'Network Security Engineer',
  'Network Architect',

  'Cloud Operations Engineer',
  'Principal Platform Architect',

  'Security Operations Engineer',
  'Cyber Security Specialist',
  'Cyber Tech Lead',

  'InfoSec Specialist',
  'AI Security Engineer',

  'Service Desk Engineer',
  'Quality Assurance Automation Engineer',

  'Application Support Engineer',

  'Data Operations Engineer',
  'Senior Data Operations Engineer',

  'ML Ops Engineer',
  'LLMOps Engineer'
]

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const now = new Date();

      // Build ordered unique list preserving departmentData order
      const roleSet = new Set();
      for (const role of departmentData) {
        roleSet.add(role);
      }

      const roleNames = Array.from(roleSet);

      if (!roleNames.length) {
        await transaction.commit();
        return;
      }

      // Check existing org_roles
      const placeholders = roleNames.map(() => '?').join(',');
      const [existing] = await queryInterface.sequelize.query(
        `SELECT role_name FROM org_roles WHERE role_name IN (${placeholders})`,
        { replacements: roleNames, transaction }
      );

      const existingNames = new Set(existing.map((r) => r.role_name));

      const toInsert = roleNames
        .filter((n) => !existingNames.has(n))
        .map((role_name) => ({ role_name, is_active: true, created_at: now, updated_at: now }));

      if (toInsert.length) {
        await queryInterface.bulkInsert('org_roles', toInsert, { transaction });
      }

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const roleNames = Array.from(new Set(departmentData));
      if (roleNames.length) {
        const placeholders = roleNames.map(() => '?').join(',');
        await queryInterface.sequelize.query(
          `DELETE FROM org_roles WHERE role_name IN (${placeholders})`,
          { replacements: roleNames, transaction }
        );
      }

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
