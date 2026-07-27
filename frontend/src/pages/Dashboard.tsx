import { Alert, Box, Button, Card, CardContent, Divider, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../i18n';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import SproutOutlinedIcon from '@mui/icons-material/SpaOutlined';
import { bedAPI, cultureAPI, fieldAPI, locationAPI, plantingPlanAPI, type Bed, type Culture, type Field, type Location, type PlantingPlan } from '../api/api';
import PageContainer from '../components/layout/PageContainer';
import PageSurface from '../components/layout/PageSurface';
import ProjectRequiredState from '../components/project/ProjectRequiredState';
import { useProjectRequirement } from '../hooks/useProjectRequirement';
import { getFirstMissingProjectSetupStep, getTranslatedProjectSetupActions } from './requirementFlow';
import { deriveLocationTasks } from './locationDerivedTasks';

export default function Dashboard() {
  const { t, i18n } = useTranslation(['dashboard', 'common']);
  const { shouldShowProjectRequiredState, missingProjectReason } = useProjectRequirement();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [plans, setPlans] = useState<PlantingPlan[]>([]);

  useEffect(() => {
    if (shouldShowProjectRequiredState) {
      setLoading(false);
      setError(null);
      setLocations([]); setFields([]); setBeds([]); setCultures([]); setPlans([]);
      return;
    }
    const fetchData = async (): Promise<void> => {
      try {
        setLoading(true);
        const [locationsRes, fieldsRes, bedsRes, culturesRes, plansRes] = await Promise.all([
          locationAPI.list(), fieldAPI.list(), bedAPI.list(), cultureAPI.list(), plantingPlanAPI.list(),
        ]);
        setLocations(locationsRes.data.results);
        setFields(fieldsRes.data.results);
        setBeds(bedsRes.data.results);
        setCultures(culturesRes.data.results);
        setPlans(plansRes.data.results);
        setError(null);
      } catch {
        setError(t('dashboard:errors.load'));
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, [shouldShowProjectRequiredState, t]);

  const firstMissingChecklistStep = getFirstMissingProjectSetupStep({
    hasFields: fields.length > 0,
    hasBeds: beds.length > 0,
    hasCultures: cultures.length > 0,
    hasPlans: plans.length > 0,
  });
  const locale = i18n.resolvedLanguage === 'de' ? 'de-DE' : 'en-US';

  const checklistItems = [
    { key: 'fields', label: t('dashboard:checklist.field'), done: fields.length > 0 },
    { key: 'beds', label: t('dashboard:checklist.bed'), done: beds.length > 0 },
    { key: 'cultures', label: t('dashboard:checklist.culture'), done: cultures.length > 0 },
    { key: 'plans', label: t('dashboard:checklist.plan'), done: plans.length > 0 },
  ] as const;

  const upcomingTasks = useMemo(() => {
    const byLocation = deriveLocationTasks({ locations, fields, beds, cultures, plantingPlans: plans });
    return Object.values(byLocation).flat().sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
  }, [beds, cultures, fields, locations, plans]);

  const locationNameById = useMemo(() => new Map(locations.filter((l) => l.id !== undefined).map((l) => [l.id as number, l.name])), [locations]);

  if (loading) return <PageContainer><PageSurface variant="contentFit"><Typography>{t('common:messages.loading')}</Typography></PageSurface></PageContainer>;
  if (shouldShowProjectRequiredState && missingProjectReason) return <PageContainer><PageSurface variant="contentFit"><ProjectRequiredState reason={missingProjectReason} /></PageSurface></PageContainer>;

  const isSetupComplete = firstMissingChecklistStep === null;
  const nextSetupActions = firstMissingChecklistStep ? getTranslatedProjectSetupActions(firstMissingChecklistStep, t) : [];

  return (
    <PageContainer>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      {!isSetupComplete ? (
        <PageSurface variant="contentFit" sx={{ mb: 2, minWidth: { md: 480 } }}>
        <Card variant="outlined" sx={{ width: 'fit-content', maxWidth: '100%' }}>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
              <SproutOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography variant="h6">{t('dashboard:checklist.title')}</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.75, maxWidth: 720, lineHeight: 1.5 }}>
              {t('dashboard:checklist.intro')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={1.6} sx={{ mb: 2.75 }}>
              {checklistItems.map((item) => {
                const isNextStep = firstMissingChecklistStep === item.key;
                return (
                  <Box key={item.key} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                    <Box sx={{ mt: 0.1 }}>
                      {item.done ? (
                        <CheckBoxIcon fontSize="small" color="success" />
                      ) : (
                        <CheckBoxOutlineBlankIcon fontSize="small" color={isNextStep ? 'primary' : 'disabled'} />
                      )}
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: isNextStep ? 700 : 500,
                        color: isNextStep ? 'text.primary' : 'text.secondary',
                        lineHeight: 1.45,
                      }}
                    >
                      {item.label}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
            {nextSetupActions.length > 0 ? (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                {nextSetupActions.map((action, index) => (
                  <Button
                    key={action.to}
                    component={RouterLink}
                    to={action.to}
                    variant={index === 0 ? 'contained' : 'outlined'}
                  >
                    {action.label}
                  </Button>
                ))}
              </Stack>
            ) : null}
          </CardContent>
        </Card>
        </PageSurface>
      ) : null}

      {(isSetupComplete || (!isSetupComplete && upcomingTasks.length > 0)) ? (
      <PageSurface variant="contentFit" sx={{ minWidth: { md: 460 } }}>
      <Card variant="outlined" sx={{ width: 'fit-content', maxWidth: '100%' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>{t('dashboard:tasks.title')}</Typography>
          {upcomingTasks.length === 0 ? (
            <>
              <Typography variant="subtitle2">{t('dashboard:tasks.emptyTitle')}</Typography>
              <Typography variant="body2">{t('dashboard:tasks.emptyDescription')}</Typography>
            </>
          ) : (
            <Stack spacing={0.75}>
              {upcomingTasks.map((task) => (
                <Box key={`${task.locationId}-${task.type}-${task.date}-${task.planId ?? 'na'}`} sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 0.5 }}>
                  <Typography variant="body2">{new Date(`${task.date}T00:00:00`).toLocaleDateString(locale)} – {t(`locations:taskTitles.${task.type}`)}</Typography>
                  <Typography variant="caption" color="text.secondary">{task.cultureName ?? ''}{task.cultureName && task.locationId ? ' · ' : ''}{locationNameById.get(task.locationId) ?? ''}</Typography>
                </Box>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
      </PageSurface>
      ) : null}
    </PageContainer>
  );
}
