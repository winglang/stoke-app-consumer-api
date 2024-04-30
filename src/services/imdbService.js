
'use strict'

const { jsonLogger } = require('stoke-app-common-api');
const alasql = require('alasql');
const _ = require('lodash');
const { sqlAggType } = require('../helpers/csvReport/constants');

const buildFilterExpression = (activeFilters, columnMapper, filterStrategies) => {
    const activeFiltersFiltered = _.reduce(activeFilters, (all, value, key) => ({
        ...all,
        ..._.size(value) ? { [key]: value } : {}
    }), {});

    return _.map(activeFiltersFiltered, (value, key) => {
        if (_.get(columnMapper, [key, 'buildFilterSqlExp'])) {
            return `(${_.get(columnMapper, [key, 'buildFilterSqlExp'])(value, _.get(filterStrategies, [key], _.get(filterStrategies, ['customFields', key], _.get(filterStrategies, ['talentProfileFields', key]))))})`
        }
        return _.get(columnMapper, key) && `[${_.get(columnMapper, [key, 'sqlExp'], _.get(columnMapper, key))}] in ('${value.join(`','`)}') `
    }).filter(Boolean).
        join(' AND ')
}

const buildStatment = (value, groupData, totalData, isGroup) => {
    const name = _.get(value, 'sqlExp') || value;
    let statment = _.get(value, 'sqlExpAgg');
    switch (_.get(value, 'sqlExpAgg')) {
        case sqlAggType.count:
            statment = ` COUNT(DISTINCT \`${name}\`) as [${name}]`;
            totalData.push(statment)
            break;
        case sqlAggType.sum:
            statment = ` SUM(\`${name}\`) as [${name}]`;
            totalData.push(statment)
            break;
        case sqlAggType.concat:
            statment = ` ARRAY(DISTINCT \`${name}\`) as [${name}]`;
            break;
        case sqlAggType.concatAll:
            statment = ` ARRAY(\`${name}\`) as [${name}]`;
            break;
        case sqlAggType.none:
            if (isGroup) {
                statment = `${`\`${name}\``}`;
                groupData.push(statment);
            }
            break;
        default:
            if (statment) {
                totalData.push(statment)
            }
            break;
    }
    return { statment, name };
}

const buildExpressions = (groupBy = [], sortModel, columnMapper) => {
    const groupData = [];
    const totalData = [];
    const selectColumnsStatment = _.map(columnMapper, (value) => {
        const { statment, name } = buildStatment(value, groupData, totalData, groupBy.length);
        return groupBy.length ? statment : name;
    }).filter(Boolean).
        join(', ')
    const groupByStatement = [...groupData, ...groupBy].filter(Boolean).join(' , ')
    const orderStatment = _.map(sortModel, (sort) => _.get(columnMapper, sort.colId) && `[${_.get(columnMapper, [sort.colId, 'sqlExp'], _.get(columnMapper, sort.colId))}] ${sort.sort}`).filter(Boolean).
        join(' , ');
    const totalDataStatment = totalData.filter(Boolean).join(', ')
    return { selectColumnsStatment, orderStatment, groupByStatement, totalDataStatment }
}

const queryImdb = (tables = [], paginationParams = {}, columnMapper = {}) => {
    try {
        const { sortModel = [], activeFilters = {}, page = {}, filterStrategies, quickFilterText, freeTextColumnMapper, groupBy = [], groupKeys = [], showSummary = true } = paginationParams
        if (_.size(groupKeys)) {
            _.forEach(groupKeys, (filter) => {
                _.set(activeFilters, filter.key, [filter.value])
            })
        }
        const realGroupBy = _.filter(_.map(groupBy, (col) => _.get(columnMapper, [col, 'sqlExp'], _.get(columnMapper, col))), Boolean);
        const { selectColumnsStatment, groupByStatement, orderStatment, totalDataStatment } = buildExpressions(realGroupBy, sortModel, columnMapper);
        const selectStatment = `select ${realGroupBy.length ? selectColumnsStatment : '*'} from ?`;
        const whereLikeStatment = quickFilterText ? _.map(freeTextColumnMapper, (col) => ` LOWER([${col}]) LIKE '%${quickFilterText.toLowerCase()}%'`).join(` OR `) : '';
        const whereFilterStatment = buildFilterExpression(activeFilters, columnMapper, filterStrategies);
        const whereStatment = !whereFilterStatment && !whereLikeStatment ? '' : ` WHERE ${whereFilterStatment} ${whereLikeStatment ? ` ${whereFilterStatment ? 'AND' : ''} (${whereLikeStatment})` : ''}`;
        const groupBySqlStatement = groupByStatement ? ` GROUP BY ${groupByStatement}` : '';
        const orderStatmentSql = orderStatment.length ? ` ORDER BY ${orderStatment} ` : '';
        const pageStatment = isNaN(page.pageSize) ? '' : ` LIMIT ${page.pageSize} OFFSET ${page.startRow}`;
        const query = `${selectStatment}${whereStatment}${groupBySqlStatement}${orderStatmentSql}${pageStatment}`;
        jsonLogger.info({ function: "imdbService::queryImdb", query });
        const rows = alasql(query, tables);
        const countStatment = `select count(*) as allDataCount from ${groupBySqlStatement ? `(select count (*) as allDataCount from ? ${whereStatment}${groupBySqlStatement})` : ` ? ${whereStatment}`}`;
        jsonLogger.info({ function: "imdbService::queryImdb", countStatment });
        const [total] = alasql(countStatment, tables);
        let summary = null;
        if (showSummary && _.size(totalDataStatment) && !_.size(groupKeys)) {
            const summaryStatment = `select ${totalDataStatment} from ? ${whereStatment}`;
            jsonLogger.info({ function: "imdbService::queryImdb", summaryStatment });
            [summary] = alasql(summaryStatment, tables);
        }
        return { rows, total, summary }
    } catch (error) {
        jsonLogger.error({ function: "imdbService::queryImdb", message: error.message });
    }
    return { rows: [], total: {}, summary: {} }
}

module.exports = {
    queryImdb
}
