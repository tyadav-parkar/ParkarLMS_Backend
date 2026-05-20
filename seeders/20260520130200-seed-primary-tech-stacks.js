'use strict';

// Seeder: populate primary_tech_stacks with unique values from Import_Data.xlsx
// Duplicates (case-insensitive) have been removed — 57 distinct entries.

const techStacks = [
  'MERN',
  'Fabric',
  'DevOps',
  'AWS',
  '.NET',
  'Python',
  'Java',
  'Databricks',
  'Windows and Servers',
  'Technical Support Operations',
  'PHP',
  'Selenium',
  'Jira Admin',
  'Power BI',
  'QA',
  'WordPress',
  'IT Support',
  'ReactJS',
  'Data QA',
  'Angular',
  'Snowflake',
  'Adobe Analytics',
  'MS Fabric',
  'Cloud Operations',
  'Juniper',
  'CISCO',
  'Endpoint Security',
  'Virtualization',
  'App Support',
  'UI/UX Designer',
  'Automation Testing',
  'Azure Sentinel & Defender',
  'Data Engineer',
  'Databrick',
  'Monitoring & Escalation',
  'GCP Data',
  'NodeJS',
  'Embedded',
  'Data Automation',
  'GenAI',
  'Automation',
  'Terraform',
  'Docker',
  'Escalation Management',
  'Oracle & MySQL',
  'SQL DBA',
  'SIEM & EDR',
  'Azure',
  'BA',
  'Business Analyst',
  'Azure DevOps Engineer',
  'Data AI Engineer',
  'Embedded QA Automation',
  'DataOps',
  'ITIL',
  'ESB Admin',
  'Core Java',
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const now = new Date();

      const [existing] = await queryInterface.sequelize.query(
        `SELECT name FROM primary_tech_stacks WHERE LOWER(name) IN (${techStacks.map(() => '?').join(',')})`,
        { replacements: techStacks.map((n) => n.toLowerCase()), transaction }
      );

      const existingNames = new Set(existing.map((r) => r.name.toLowerCase()));

      const toInsert = techStacks
        .filter((n) => !existingNames.has(n.toLowerCase()))
        .map((name) => ({ name, is_active: true, created_at: now, updated_at: now }));

      if (toInsert.length) {
        await queryInterface.bulkInsert('primary_tech_stacks', toInsert, { transaction });
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
      const placeholders = techStacks.map(() => '?').join(',');
      await queryInterface.sequelize.query(
        `DELETE FROM primary_tech_stacks WHERE LOWER(name) IN (${placeholders})`,
        { replacements: techStacks.map((n) => n.toLowerCase()), transaction }
      );
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};
