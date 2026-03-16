'use strict';

const { Op } = require('sequelize');
const { Employee, Department } = require('../../models');

const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 100;

const getTeamByManager = async (managerId, { page = 1, limit = DEFAULT_LIMIT, search = '' } = {}) => {
	const safePage = Math.max(1, parseInt(page, 10) || 1);
	const safeLimit = Math.min(MAX_LIMIT, parseInt(limit, 10) || DEFAULT_LIMIT);
	const offset = (safePage - 1) * safeLimit;
	const trimmed = search.trim();

	const whereClause = {
		manager_id: managerId,
		...(trimmed
			? {
					[Op.or]: [
						{ first_name: { [Op.iLike]: `%${trimmed}%` } },
						{ last_name: { [Op.iLike]: `%${trimmed}%` } },
						{ email: { [Op.iLike]: `%${trimmed}%` } },
						{ job_title: { [Op.iLike]: `%${trimmed}%` } },
					],
				}
			: {}),
	};

	const total = await Employee.count({ where: whereClause });

	const data = await Employee.findAll({
		where: whereClause,
		attributes: [
			'id',
			'employee_number',
			'first_name',
			'last_name',
			'email',
			'job_title',
			'band_identifier',
		],
		include: [
			{
				model: Department,
				as: 'department',
				attributes: ['id', 'name'],
				required: false,
			},
		],
		order: [['first_name', 'ASC'], ['last_name', 'ASC']],
		limit: safeLimit,
		offset,
		subQuery: false,
	});

	return {
		data,
		meta: {
			total,
			page: safePage,
			limit: safeLimit,
			pages: Math.ceil(total / safeLimit),
		},
	};
};

module.exports = { getTeamByManager };