import React from 'react'
import { ChartFilter } from 'lib/components/ChartFilter'
import { CompareFilter } from 'lib/components/CompareFilter/CompareFilter'
import { IntervalFilter } from 'lib/components/IntervalFilter'
import { ACTIONS_BAR_CHART_VALUE, ACTIONS_PIE_CHART, ACTIONS_TABLE } from 'lib/constants'
import { FilterType, FunnelVizType, ItemMode, InsightType } from '~/types'
import { CalendarOutlined } from '@ant-design/icons'
import { InsightDateFilter } from '../InsightDateFilter'
import { RetentionDatePicker } from '../RetentionDatePicker'
import { FunnelDisplayLayoutPicker } from './FunnelTab/FunnelDisplayLayoutPicker'
import { FunnelBinsPicker } from 'scenes/insights/InsightTabs/FunnelTab/FunnelBinsPicker'
import { PathStepPicker } from './PathTab/PathStepPicker'
import { ReferencePicker as RetentionReferencePicker } from './RetentionTab/ReferencePicker'
import { Tooltip } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'

interface InsightDisplayConfigProps {
    filters: FilterType
    activeView: InsightType
    insightMode: ItemMode
    disableTable: boolean
}

const showIntervalFilter = function (activeView: InsightType, filter: FilterType): boolean {
    switch (activeView) {
        case InsightType.FUNNELS:
            return filter.funnel_viz_type === FunnelVizType.Trends
        case InsightType.RETENTION:
        case InsightType.PATHS:
            return false
        case InsightType.TRENDS:
        case InsightType.STICKINESS:
        case InsightType.LIFECYCLE:
        default:
            return ![ACTIONS_PIE_CHART, ACTIONS_TABLE, ACTIONS_BAR_CHART_VALUE].includes(filter.display || '') // sometimes insights aren't set for trends
    }
}

const showChartFilter = function (activeView: InsightType): boolean {
    switch (activeView) {
        case InsightType.TRENDS:
        case InsightType.STICKINESS:
            return true
        case InsightType.RETENTION:
        case InsightType.FUNNELS:
            return false
        case InsightType.LIFECYCLE:
        case InsightType.PATHS:
            return false
        default:
            return true // sometimes insights aren't set for trends
    }
}

const showDateFilter = {
    [`${InsightType.TRENDS}`]: true,
    [`${InsightType.STICKINESS}`]: true,
    [`${InsightType.LIFECYCLE}`]: true,
    [`${InsightType.FUNNELS}`]: true,
    [`${InsightType.RETENTION}`]: false,
    [`${InsightType.PATHS}`]: true,
}

const showComparePrevious = {
    [`${InsightType.TRENDS}`]: true,
    [`${InsightType.STICKINESS}`]: true,
    [`${InsightType.LIFECYCLE}`]: false,
    [`${InsightType.FUNNELS}`]: false,
    [`${InsightType.RETENTION}`]: false,
    [`${InsightType.PATHS}`]: false,
}

const isFunnelEmpty = (filters: FilterType): boolean => {
    return (!filters.actions && !filters.events) || (filters.actions?.length === 0 && filters.events?.length === 0)
}

export function InsightDisplayConfig({ filters, activeView, disableTable }: InsightDisplayConfigProps): JSX.Element {
    const showFunnelBarOptions = activeView === InsightType.FUNNELS
    const showPathOptions = activeView === InsightType.PATHS
    const dateFilterDisabled = showFunnelBarOptions && isFunnelEmpty(filters)

    return (
        <div className="display-config-inner">
            <div className="display-config-inner-row">
                {showDateFilter[activeView] && !disableTable && (
                    <span className="filter">
                        <span className="head-title-item">Date range</span>
                        <InsightDateFilter
                            defaultValue="Last 7 days"
                            disabled={dateFilterDisabled}
                            bordered
                            makeLabel={(key) => (
                                <>
                                    <CalendarOutlined /> {key}
                                    {key == 'All time' && (
                                        <Tooltip title={`Only events dated after 2015 will be shown`}>
                                            <InfoCircleOutlined className="info-indicator" />
                                        </Tooltip>
                                    )}
                                </>
                            )}
                        />
                    </span>
                )}

                {showIntervalFilter(activeView, filters) && (
                    <span className="filter">
                        <span className="head-title-item">
                            <span className="hide-lte-md">grouped </span>by
                        </span>
                        <IntervalFilter view={activeView} />
                    </span>
                )}

                {activeView === InsightType.RETENTION && (
                    <>
                        <RetentionDatePicker />
                        <RetentionReferencePicker />
                    </>
                )}

                {showPathOptions && (
                    <span className="filter">
                        <PathStepPicker />
                    </span>
                )}

                {showComparePrevious[activeView] && (
                    <span className="filter">
                        <CompareFilter />
                    </span>
                )}
            </div>
            <div className="display-config-inner-row">
                {showChartFilter(activeView) && (
                    <span className="filter">
                        <span className="head-title-item">Chart type</span>
                        <ChartFilter filters={filters} disabled={filters.insight === InsightType.LIFECYCLE} />
                    </span>
                )}
                {showFunnelBarOptions && filters.funnel_viz_type === FunnelVizType.Steps && (
                    <>
                        <span className="filter">
                            <FunnelDisplayLayoutPicker />
                        </span>
                    </>
                )}
                {showFunnelBarOptions && filters.funnel_viz_type === FunnelVizType.TimeToConvert && (
                    <span className="filter">
                        <FunnelBinsPicker />
                    </span>
                )}
            </div>
        </div>
    )
}
