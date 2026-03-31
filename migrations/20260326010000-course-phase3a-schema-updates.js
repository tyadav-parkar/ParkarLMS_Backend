'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDef = await queryInterface.describeTable('courses');

    if (!tableDef.difficulty) {
      await queryInterface.addColumn('courses', 'difficulty', {
        type: Sequelize.ENUM('Beginner', 'Intermediate', 'Advanced'),
        allowNull: false,
        defaultValue: 'Beginner',
      });
    }

    await queryInterface.renameColumn('courses', 'estimated_duration_months', 'estimated_duration_hours');

    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS courses_active_name_unique_idx ON courses (LOWER(name)) WHERE is_active = true'
    );
    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS courses_is_active_category_idx ON courses (is_active, category)'
    );
    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS courses_created_at_desc_idx ON courses (created_at DESC)'
    );
    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS courses_lower_name_idx ON courses (LOWER(name))'
    );
    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS course_assignments_course_status_assigned_date_idx ON course_assignments (course_id, status, assigned_date DESC)'
    );

    const existingConstraint = await queryInterface.sequelize.query(
      "SELECT 1 FROM pg_constraint WHERE conname = 'course_assignments_completion_status_check'",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (!existingConstraint.length) {
      await queryInterface.sequelize.query(`
        ALTER TABLE course_assignments
        ADD CONSTRAINT course_assignments_completion_status_check
        CHECK (
          (status = 'completed' AND completion_date IS NOT NULL)
          OR
          (status <> 'completed' AND completion_date IS NULL)
        )
      `);
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE course_assignments DROP CONSTRAINT IF EXISTS course_assignments_completion_status_check'
    );

    await queryInterface.sequelize.query('DROP INDEX IF EXISTS course_assignments_course_status_assigned_date_idx');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS courses_lower_name_idx');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS courses_created_at_desc_idx');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS courses_is_active_category_idx');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS courses_active_name_unique_idx');

    const tableDef = await queryInterface.describeTable('courses');
    if (tableDef.estimated_duration_hours) {
      await queryInterface.renameColumn('courses', 'estimated_duration_hours', 'estimated_duration_months');
    }

    if (tableDef.difficulty) {
      await queryInterface.removeColumn('courses', 'difficulty');
    }

    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_courses_difficulty"');
  },

};

