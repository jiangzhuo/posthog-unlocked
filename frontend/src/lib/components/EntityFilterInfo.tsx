import { ActionFilter, EntityFilter, EntityTypes, FunnelStepRangeEntityFilter } from '~/types'
import { Typography } from 'antd'
import React from 'react'
import { TextProps } from 'antd/lib/typography/Text'
import { getKeyMapping } from 'lib/components/PropertyKeyInfo'
import { getDisplayNameFromEntityFilter } from 'scenes/insights/utils'

interface EntityFilterInfoProps {
    filter: EntityFilter | ActionFilter | FunnelStepRangeEntityFilter
    allowWrap?: boolean
}

function TextWrapper(props: TextProps): JSX.Element {
    return (
        <Typography.Text style={{ maxWidth: 400 }} {...props}>
            {props.children}
        </Typography.Text>
    )
}

export function EntityFilterInfo({ filter, allowWrap = false }: EntityFilterInfoProps): JSX.Element {
    const title = getDisplayNameFromEntityFilter(filter, false)

    // No filter
    if (filter.type === EntityTypes.NEW_ENTITY || !title) {
        return <TextWrapper title="Select filter">Select filter</TextWrapper>
    }

    const titleToDisplay = getKeyMapping(title, 'event')?.label?.trim() ?? title ?? undefined

    // No custom name
    if (!filter?.custom_name) {
        return (
            <span style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                <TextWrapper ellipsis={!allowWrap} title={titleToDisplay}>
                    {titleToDisplay}
                </TextWrapper>
            </span>
        )
    }

    // Display custom name first and action title as secondary
    const customTitle = getDisplayNameFromEntityFilter(filter, true)

    return (
        <span style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <TextWrapper ellipsis={!allowWrap} title={customTitle ?? undefined}>
                {customTitle}
            </TextWrapper>
            <TextWrapper
                ellipsis={!allowWrap}
                type="secondary"
                style={{ fontSize: 13, marginLeft: 4 }}
                title={titleToDisplay}
            >
                ({titleToDisplay})
            </TextWrapper>
        </span>
    )
}
