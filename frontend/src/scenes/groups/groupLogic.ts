import { kea } from 'kea'
import api from 'lib/api'
import { toParams } from 'lib/utils'
import { teamLogic } from 'scenes/teamLogic'
import { groupsModel } from '~/models/groupsModel'
import { Breadcrumb, Group } from '~/types'
import { groupLogicType } from './groupLogicType'
import { urls } from 'scenes/urls'
import { capitalizeFirstLetter } from 'lib/utils'

export const groupLogic = kea<groupLogicType>({
    path: ['groups', 'groupLogic'],
    connect: { values: [teamLogic, ['currentTeamId'], groupsModel, ['groupTypes', 'aggregationLabel']] },
    actions: () => ({
        setGroup: (groupTypeIndex: number, groupKey: string) => ({ groupTypeIndex, groupKey }),
        setActiveCardTab: (tab: 'properties' | 'related') => ({ tab }),
    }),
    loaders: ({ values }) => ({
        groupData: [
            null as Group | null,
            {
                loadGroup: async () => {
                    const params = { group_type_index: values.groupTypeIndex, group_key: values.groupKey }
                    const url = `api/projects/${values.currentTeamId}/groups/find?${toParams(params)}`
                    return await api.get(url)
                },
            },
        ],
    }),
    reducers: {
        groupTypeIndex: [
            0,
            {
                setGroup: (_, { groupTypeIndex }) => groupTypeIndex,
            },
        ],
        groupKey: [
            '',
            {
                setGroup: (_, { groupKey }) => groupKey,
            },
        ],
        activeCardTab: [
            'properties' as 'properties' | 'related',
            {
                setActiveCardTab: (_, { tab }) => tab,
                setGroup: () => 'properties',
            },
        ],
    },
    selectors: {
        groupTypeName: [
            (s) => [s.aggregationLabel, s.groupTypeIndex],
            (aggregationLabel, index): string => aggregationLabel(index).singular,
        ],
        breadcrumbs: [
            (s) => [s.groupTypeName, s.groupTypeIndex, s.groupKey],
            (groupTypeName, groupTypeIndex, groupKey): Breadcrumb[] => [
                {
                    name: capitalizeFirstLetter(groupTypeName),
                    path: urls.groups(String(groupTypeIndex)),
                },
                {
                    name: groupKey,
                    path: urls.group(String(groupTypeIndex), groupKey),
                },
            ],
        ],
    },
    urlToAction: ({ actions }) => ({
        '/groups/:groupTypeIndex/:groupKey': ({ groupTypeIndex, groupKey }) => {
            if (groupTypeIndex && groupKey) {
                actions.setGroup(+groupTypeIndex, decodeURIComponent(groupKey))
                actions.loadGroup()
            }
        },
    }),
})
