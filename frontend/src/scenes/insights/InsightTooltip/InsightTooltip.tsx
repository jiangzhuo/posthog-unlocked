import './InsightTooltip.scss'
import React from 'react'
import { LemonTable, LemonTableColumns } from 'lib/components/LemonTable'
import {
    COL_CUTOFF,
    ROW_CUTOFF,
    getTooltipTitle,
    InsightTooltipProps,
    invertDataSource,
    InvertedSeriesDatum,
    SeriesDatum,
    getFormattedDate,
} from './insightTooltipUtils'
import { InsightLabel } from 'lib/components/InsightLabel'
import { SeriesLetter } from 'lib/components/SeriesGlyph'
import { IconHandClick } from 'lib/components/icons'

function ClickToInspectActors({
    isTruncated,
    groupTypeLabel,
}: {
    isTruncated: boolean
    groupTypeLabel: string
}): JSX.Element {
    return (
        <div className="table-subtext">
            {isTruncated && (
                <div className="table-subtext-truncated">
                    For readability, <b>not all series are displayed</b>.<br />
                </div>
            )}
            <div className="table-subtext-click-to-inspect">
                <IconHandClick style={{ marginRight: 4, marginBottom: 2 }} />
                Click to view {groupTypeLabel}
            </div>
        </div>
    )
}

export function InsightTooltip({
    date,
    seriesData = [],
    altTitle,
    altRightTitle,
    renderSeries = (value: React.ReactNode, _: SeriesDatum, idx: number) => (
        <>
            <SeriesLetter className="mr-025" hasBreakdown={false} seriesIndex={idx} />
            {value}
        </>
    ),
    hideColorCol = false,
    forceEntitiesAsColumns = false,
    rowCutoff = ROW_CUTOFF,
    colCutoff = COL_CUTOFF,
    showHeader = true,
    groupTypeLabel = 'people',
}: InsightTooltipProps): JSX.Element {
    // If multiple entities exist (i.e., pageview + autocapture) and there is a breakdown/compare/multi-group happening, itemize entities as columns to save vertical space..
    // If only a single entity exists, itemize entity counts as rows.
    // Throw these rules out the window if `forceEntitiesAsColumns` is true
    const itemizeEntitiesAsColumns =
        forceEntitiesAsColumns ||
        (seriesData?.length > 1 && (seriesData?.[0]?.breakdown_value || seriesData?.[0]?.compare_label))
    const title =
        getTooltipTitle(seriesData, altTitle, date) ?? getFormattedDate(date, seriesData?.[0]?.filter?.interval)
    const rightTitle = getTooltipTitle(seriesData, altRightTitle, date) ?? null

    const renderTable = (): JSX.Element => {
        if (itemizeEntitiesAsColumns) {
            const dataSource = invertDataSource(seriesData)
            const columns: LemonTableColumns<InvertedSeriesDatum> = []
            const numDataPoints = Math.max(...dataSource.map((ds) => ds?.seriesData?.length ?? 0))
            const isTruncated = numDataPoints > colCutoff || dataSource.length > rowCutoff

            columns.push({
                key: 'datum',
                className: 'datum-column',
                title,
                sticky: true,
                render: function renderDatum(_, datum) {
                    return <div>{datum.datumTitle}</div>
                },
            })

            if (numDataPoints > 0) {
                const indexOfLongestSeries = dataSource.findIndex((ds) => ds?.seriesData?.length === numDataPoints)
                const truncatedCols = dataSource?.[
                    indexOfLongestSeries !== -1 ? indexOfLongestSeries : 0
                ].seriesData.slice(0, colCutoff)
                truncatedCols.forEach((seriesColumn, colIdx) => {
                    columns.push({
                        key: `series-column-data-${colIdx}`,
                        align: 'right',
                        title:
                            (colIdx === 0 ? rightTitle : undefined) ||
                            (!altTitle &&
                                renderSeries(
                                    <InsightLabel
                                        className="series-column-header"
                                        action={seriesColumn.action}
                                        fallbackName={seriesColumn.label}
                                        hideBreakdown
                                        hideCompare
                                        hideIcon
                                        allowWrap
                                    />,
                                    seriesColumn,
                                    colIdx
                                )),
                        render: function renderSeriesColumnData(_, datum) {
                            return <div className="series-data-cell">{datum.seriesData?.[colIdx]?.count ?? 0}</div>
                        },
                    })
                })
            }

            return (
                <>
                    <LemonTable
                        dataSource={dataSource.slice(0, rowCutoff)}
                        columns={columns}
                        rowKey="id"
                        size="small"
                        uppercaseHeader={false}
                        showHeader={showHeader}
                    />
                    <ClickToInspectActors isTruncated={isTruncated} groupTypeLabel={groupTypeLabel} />
                </>
            )
        }

        // Itemize tooltip entities as rows
        const dataSource = [...seriesData]
        const columns: LemonTableColumns<SeriesDatum> = []
        const isTruncated = dataSource?.length > rowCutoff

        if (!hideColorCol) {
            columns.push({
                key: 'color',
                className: 'color-column',
                sticky: true,
                width: 6,
                render: function renderColor(_, datum) {
                    return <div className="color-cell" style={{ backgroundColor: datum.color }} />
                },
            })
        }

        columns.push({
            key: 'datum',
            className: 'datum-label-column',
            width: 120,
            title,
            sticky: true,
            render: function renderDatum(_, datum, rowIdx) {
                return renderSeries(
                    <InsightLabel
                        action={datum.action}
                        fallbackName={datum.label}
                        hideBreakdown
                        hideCompare
                        hideIcon
                        allowWrap
                    />,
                    datum,
                    rowIdx
                )
            },
        })

        columns.push({
            key: 'counts',
            className: 'datum-counts-column',
            width: 50,
            title: <span style={{ whiteSpace: 'nowrap' }}>{rightTitle ?? undefined}</span>,
            align: 'right',
            render: function renderDatum(_, datum) {
                return <div className="series-data-cell">{datum.count ?? 0}</div>
            },
        })

        return (
            <>
                <LemonTable
                    dataSource={dataSource.slice(0, rowCutoff)}
                    columns={columns}
                    rowKey="id"
                    size="small"
                    uppercaseHeader={false}
                    showHeader={showHeader}
                />
                <ClickToInspectActors isTruncated={isTruncated} groupTypeLabel={groupTypeLabel} />
            </>
        )
    }

    return renderTable()
}
