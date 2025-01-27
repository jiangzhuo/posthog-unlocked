import { router } from 'kea-router'
import { expectLogic } from 'kea-test-utils'
import { mockAPI, MOCK_TEAM_ID } from 'lib/api.mock'
import { urls } from 'scenes/urls'
import { initKeaTestLogic } from '~/test/init'
import { InsightType } from '~/types'
import { experimentLogic } from './experimentLogic'

jest.mock('lib/api')

const RUNNING_EXP_ID = 45
const RUNNING_FUNNEL_EXP_ID = 46

describe('experimentLogic', () => {
    let logic: ReturnType<typeof experimentLogic.build>

    mockAPI(async ({ pathname }) => {
        if (pathname === `api/projects/${MOCK_TEAM_ID}/insights`) {
            return { short_id: 'a5qqECqP', filters: { insight: InsightType.FUNNELS } }
        } else if (pathname === `api/projects/${MOCK_TEAM_ID}/experiments`) {
            return {
                count: 1,
                next: null,
                previous: null,
                results: [{ id: 1, name: 'Test Exp', description: 'bla' }],
            }
        } else if (
            pathname === `api/projects/${MOCK_TEAM_ID}/experiments/${RUNNING_EXP_ID}` ||
            pathname === `api/projects/${MOCK_TEAM_ID}/experiments/${RUNNING_FUNNEL_EXP_ID}`
        ) {
            return {
                created_at: '2022-01-13T12:44:45.944423Z',
                created_by: { id: 1, uuid: '017dc2ea-ace1-0000-c9ed-a6e43fd8956b' },
                description: 'badum tssss',
                feature_flag_key: 'test-experiment',
                filters: {
                    events: [{ id: 'user signup', name: 'user signup', type: 'events', order: 0 }],
                    insight: 'FUNNELS',
                },
                id: RUNNING_EXP_ID,
                name: 'test experiment',
                parameters: {
                    feature_flag_variants: [
                        { key: 'control', rollout_percentage: 25 },
                        { key: 'test_1', rollout_percentage: 25 },
                        { key: 'test_2', rollout_percentage: 25 },
                        { key: 'test_3', rollout_percentage: 25 },
                    ],
                    recommended_running_time: 20.2,
                    recommended_sample_size: 2930,
                },
                start_date: '2022-01-13T13:25:29.896000Z',
                updated_at: '2022-01-13T13:25:38.462106Z',
            }
        } else if (pathname === `api/projects/${MOCK_TEAM_ID}/experiments/${RUNNING_EXP_ID}/results`) {
            return {
                filters: { breakdown: '$feature/test-experiment', breakdown_type: 'event', insight: 'TRENDS' },
                insight: [
                    { breakdown_value: 'control', count: 200 },
                    { breakdown_value: 'test_1', count: 400 },
                    { breakdown_value: 'test_2', count: 500 },
                    { breakdown_value: 'test_3', count: 100 },
                ],
                probability: { control: 0.7, test_1: 0.1, test_2: 0.2, test_3: 0 },
            }
        } else if (pathname === `api/projects/${MOCK_TEAM_ID}/experiments/${RUNNING_FUNNEL_EXP_ID}/results`) {
            return {
                filters: { breakdown: '$feature/test-experiment', breakdown_type: 'event', insight: 'FUNNELS' },
                insight: [
                    [
                        { breakdown_value: ['control'], count: 200, order: 0 },
                        { breakdown_value: ['control'], count: 100, order: 1 },
                    ],
                    [
                        { breakdown_value: ['test_1'], count: 200, order: 0 },
                        { breakdown_value: ['test_1'], count: 120, order: 1 },
                    ],
                    [
                        { breakdown_value: ['test_2'], count: 200, order: 0 },
                        { breakdown_value: ['test_2'], count: 140, order: 1 },
                    ],
                    [
                        { breakdown_value: ['test_3'], count: 200, order: 0 },
                        { breakdown_value: ['test_3'], count: 160, order: 1 },
                    ],
                ],
                probability: { control: 0.7, test_1: 0.1, test_2: 0.2, test_3: 0 },
            }
        }
    })

    initKeaTestLogic({
        logic: experimentLogic,
        props: {},
        onLogic: (l) => (logic = l),
    })

    describe('when creating a new experiment', () => {
        it('creates an insight funnel and clears the new experiment form', async () => {
            router.actions.push(urls.experiment('new'))
            await expectLogic(logic).toDispatchActions(['setExperimentInsightId']).toMatchValues({
                experimentInsightId: 'a5qqECqP',
            })
        })
    })

    describe('selector values', () => {
        it('given a sample size and conversion rate, calculates correct mde', async () => {
            expect(logic.values.mdeGivenSampleSizeAndConversionRate(1000, 20)).toBeCloseTo(5.059)
            expect(logic.values.mdeGivenSampleSizeAndConversionRate(100, 20)).toBeCloseTo(16)

            expect(logic.values.mdeGivenSampleSizeAndConversionRate(1000, 50)).toBeCloseTo(6.324)
            expect(logic.values.mdeGivenSampleSizeAndConversionRate(100, 50)).toBeCloseTo(20)

            expect(logic.values.mdeGivenSampleSizeAndConversionRate(1000, 0)).toBeCloseTo(0)
            expect(logic.values.mdeGivenSampleSizeAndConversionRate(100, 0)).toBeCloseTo(0)
        })

        it('given an mde, calculates correct sample size', async () => {
            logic.actions.setNewExperimentData({ parameters: { minimum_detectable_effect: 10 } })

            await expectLogic(logic).toMatchValues({
                minimumDetectableChange: 10,
            })

            expect(logic.values.minimumSampleSizePerVariant(20)).toEqual(256)

            expect(logic.values.minimumSampleSizePerVariant(40)).toEqual(384)

            expect(logic.values.minimumSampleSizePerVariant(0)).toEqual(0)
        })

        it('given count data and exposure, calculates correct mde', async () => {
            expect(logic.values.mdeGivenCountData(5000)).toEqual(201)
            expect(logic.values.mdeGivenCountData(500)).toEqual(64)

            expect(logic.values.mdeGivenCountData(1000000)).toEqual(2829)
            expect(logic.values.mdeGivenCountData(10000)).toEqual(283)
            expect(logic.values.mdeGivenCountData(1000)).toEqual(90)
            expect(logic.values.mdeGivenCountData(100)).toEqual(29)
            expect(logic.values.mdeGivenCountData(10)).toEqual(9)
            expect(logic.values.mdeGivenCountData(1)).toEqual(3)
        })

        it('given sample size and entrants, calculates correct running time', async () => {
            // 500 entrants over 14 days, 1000 sample size, so need twice the time
            expect(logic.values.expectedRunningTime(500, 1000)).toEqual(28)

            // 500 entrants over 14 days, 250 sample size, so need half the time
            expect(logic.values.expectedRunningTime(500, 250)).toEqual(7)

            // 0 entrants over 14 days, so infinite running time
            expect(logic.values.expectedRunningTime(0, 1000)).toEqual(Infinity)
        })

        it('given control count data, calculates correct running time', async () => {
            // 1000 count over 14 days
            expect(logic.values.recommendedExposureForCountData(1000)).toEqual(91.8)

            // 10,000 entrants over 14 days
            // 10x entrants, so 1/10th running time
            expect(logic.values.recommendedExposureForCountData(10000)).toEqual(9.2)

            // 0 entrants over 14 days, so infinite running time
            expect(logic.values.recommendedExposureForCountData(0)).toEqual(Infinity)
        })

        it('calculates bestCountVariant and significance correctly', async () => {
            router.actions.push(urls.experiment(RUNNING_EXP_ID))

            await expectLogic(logic)
                .toFinishListeners()
                .toMatchValues({
                    bestCountVariant: { value: 500, variant: { key: 'test_2', rollout_percentage: 25 } },
                    areCountResultsSignificant: true,
                })

            expect(logic.values.mdeGivenCountData(200)).toEqual(41)
        })

        it('calculates bestConversionVariant and significance correctly', async () => {
            router.actions.push(urls.experiment(RUNNING_FUNNEL_EXP_ID))

            await expectLogic(logic)
                .toFinishListeners()
                .toMatchValues({
                    bestConversionVariant: { value: 80, variant: { key: 'test_3', rollout_percentage: 25 } },
                    areConversionResultsSignificant: true,
                })

            expect(logic.values.mdeGivenSampleSizeAndConversionRate(200, 50)).toBeCloseTo(14.142)
        })
    })
})
