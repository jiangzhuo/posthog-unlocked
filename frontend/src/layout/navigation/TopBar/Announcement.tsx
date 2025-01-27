import React from 'react'
import ReactMarkdown from 'react-markdown'
import clsx from 'clsx'
import { CloseOutlined } from '@ant-design/icons'
import { MOCK_NODE_PROCESS } from 'lib/constants'
import { announcementLogic, AnnouncementType } from '~/layout/navigation/TopBar/announcementLogic'
import { useActions, useValues } from 'kea'
import { GroupsIntroductionBanner } from 'lib/introductions/GroupsIntroductionBanner'
import { preflightLogic } from 'scenes/PreflightCheck/logic'

window.process = MOCK_NODE_PROCESS

export function Announcement(): JSX.Element | null {
    const { shownAnnouncementType, cloudAnnouncement, closable } = useValues(announcementLogic)
    const { preflight } = useValues(preflightLogic)
    const { hideAnnouncement } = useActions(announcementLogic)

    let message: JSX.Element | undefined
    if (preflight?.demo) {
        message = (
            <b>
                Welcome to PostHog's demo environment. To level up,{' '}
                <a href="https://posthog.com/signup">deploy your own PostHog instance or sign up for PostHog Cloud</a>.
            </b>
        )
    } else if (shownAnnouncementType === AnnouncementType.CloudFlag && cloudAnnouncement) {
        message = <ReactMarkdown className="strong">{cloudAnnouncement}</ReactMarkdown>
    } else if (shownAnnouncementType === AnnouncementType.GroupAnalytics) {
        message = <GroupsIntroductionBanner />
    }

    return (
        <div className={clsx('Announcement', !shownAnnouncementType && 'Announcement--hidden')}>
            {message}
            {closable && (
                <CloseOutlined
                    className="Announcement__close"
                    onClick={() => hideAnnouncement(shownAnnouncementType)}
                />
            )}
        </div>
    )
}
