import { useEffect, useMemo, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import {
  Alert,
  Stack,
  Typography,
} from "@mui/material";
import {
  plantingPlanAPI,
  yieldCalendarAPI,
  type PlantingPlan,
  type YieldCalendarWeek,
} from "../api/api";
import PageContainer from "../components/layout/PageContainer";
import PageSurface from "../components/layout/PageSurface";
import EmptyStateCard from "../components/project/EmptyStateCard";
import ProjectRequiredState from "../components/project/ProjectRequiredState";
import { useProjectRequirement } from "../hooks/useProjectRequirement";
import { useTranslation } from "../i18n";
import { YieldFilterBar } from "./YieldFilterBar";
import { YieldDistributionChart } from "./YieldDistributionChart";
import {
  ALL_CULTURES,
  type ChartPeriod,
  type YieldCultureMeta,
} from "./yieldOverviewUtils";
import { getCultureDisplayName } from "../cultures/cultureDisplay";

export default function YieldOverviewPage() {
  const { t, i18n } = useTranslation("yieldOverview");
  const { shouldShowProjectRequiredState, missingProjectReason } =
    useProjectRequirement();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedCultureId, setSelectedCultureId] = useState(ALL_CULTURES);
  const [period, setPeriod] = useState<ChartPeriod>("week");
  const [isFetching, setLoading] = useState(true);
  const [fetchError, setError] = useState<string | null>(null);
  const [plantingPlans, setPlantingPlans] = useState<PlantingPlan[]>([]);
  const [weeklyYield, setWeeklyYield] = useState<YieldCalendarWeek[]>([]);

  // Without a project there is nothing to fetch, so the page is neither
  // loading nor in error. Derived rather than pushed into state from the
  // effect below — the fetched collections do not need clearing either,
  // because the project-required branch renders before they are read and
  // `loading` is back to true by the time a project appears.
  const loading = shouldShowProjectRequiredState ? false : isFetching;
  const error = shouldShowProjectRequiredState ? null : fetchError;

  useEffect(() => {
    if (shouldShowProjectRequiredState) {
      return;
    }

    // React 18 StrictMode intentionally double-invokes this effect in dev,
    // firing the request twice; without this guard the slower/stale response
    // can resolve after the newer one and silently overwrite it with old data.
    let ignore = false;

    const fetchData = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        const [plansRes, weeklyYieldRes] = await Promise.all([
          plantingPlanAPI.list(),
          yieldCalendarAPI.list(selectedYear),
        ]);
        if (ignore) {
          return;
        }
        setPlantingPlans(plansRes.data.results);
        setWeeklyYield(weeklyYieldRes.data);
      } catch (err) {
        if (ignore) {
          return;
        }
        console.error("Error fetching yield overview data:", err);
        setError(t("errors.load"));
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    void fetchData();
    return () => {
      ignore = true;
    };
  }, [selectedYear, shouldShowProjectRequiredState, t]);

  const cultures = useMemo(() => {
    const cultureMap = new Map<number, YieldCultureMeta>();
    weeklyYield.forEach((week) => {
      week.cultures.forEach((culture) => {
        cultureMap.set(culture.culture_id, {
          id: culture.culture_id,
          name: getCultureDisplayName(culture),
          color: culture.color,
        });
      });
    });
    return [...cultureMap.values()].sort((left, right) =>
      left.name.localeCompare(
        right.name,
        i18n.resolvedLanguage ?? i18n.language,
      ),
    );
  }, [i18n.language, i18n.resolvedLanguage, weeklyYield]);

  useEffect(() => {
    if (
      selectedCultureId !== ALL_CULTURES &&
      !cultures.some(
        (culture) => String(culture.id) === selectedCultureId,
      )
    ) {
      setSelectedCultureId(ALL_CULTURES);
    }
  }, [cultures, selectedCultureId]);

  if (loading) {
    return (
      <PageContainer variant="workspacePage">
        <PageSurface variant="fullWorkspace" sx={{ py: 2 }}>
          <Typography variant="body1">{t("loading")}</Typography>
        </PageSurface>
      </PageContainer>
    );
  }

  if (shouldShowProjectRequiredState && missingProjectReason) {
    return (
      <PageContainer variant="workspacePage">
        <PageSurface variant="fullWorkspace">
          <ProjectRequiredState reason={missingProjectReason} />
        </PageSurface>
      </PageContainer>
    );
  }

  const hasPlantingPlans = plantingPlans.length > 0;
  const hasYieldData = weeklyYield.length > 0;

  return (
    <PageContainer variant="workspacePage">
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}
      <PageSurface variant="fullWorkspace">
        <Stack spacing={2}>
          <YieldFilterBar
            cultures={cultures}
            selectedCultureId={selectedCultureId}
            selectedYear={selectedYear}
            period={period}
            onCultureChange={setSelectedCultureId}
            onYearChange={setSelectedYear}
            onPeriodChange={setPeriod}
          />

          {!hasPlantingPlans ? (
            <EmptyStateCard
              title={t("empty.noPlansTitle")}
              description={t("empty.description")}
              actions={[
                {
                  label: t("empty.createPlanAction"),
                  to: "/app/planting-plans?action=create",
                  icon: <AddIcon fontSize="small" />,
                },
              ]}
              containerSx={{ maxWidth: "none", mb: 0 }}
            />
          ) : hasYieldData ? (
            <YieldDistributionChart
              weeklyYield={weeklyYield}
              selectedCultureId={selectedCultureId}
              period={period}
            />
          ) : (
            <EmptyStateCard
              title={t("empty.noYieldTitle", { year: selectedYear })}
              description={t("empty.noYieldDescription", { year: selectedYear })}
              actions={[
                { label: t("empty.openPlansAction"), to: "/app/planting-plans" },
              ]}
              containerSx={{ maxWidth: "none", mb: 0 }}
            />
          )}
        </Stack>
      </PageSurface>
    </PageContainer>
  );
}
