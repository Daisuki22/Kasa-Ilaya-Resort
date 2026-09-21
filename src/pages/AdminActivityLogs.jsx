import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow, subDays } from 'date-fns';
import {
	Activity,
	BarChart3,
	Loader2,
	RefreshCw,
	Search,
	ShieldAlert,
	ShieldCheck,
	Users,
} from 'lucide-react';
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Line,
	LineChart,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import { baseClient } from '@/api/baseClient';
import ActivityLogSummaryCards from '@/components/admin/ActivityLogSummaryCards';
import { useAuth } from '@/lib/AuthContext';
import { isSuperAdmin } from '@/lib/adminAccess';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
	activityLogSeverityStyles,
	getActivityLogSeverity,
	matchesActivityLogSearch,
} from '@/lib/activityLogAnalytics';

const chartColors = {
	low: 'hsl(var(--primary))',
	medium: 'hsl(var(--secondary))',
	high: 'hsl(var(--destructive))',
	entity: [
		'hsl(var(--primary))',
		'hsl(var(--secondary))',
		'hsl(var(--chart-3))',
		'hsl(var(--chart-4))',
		'hsl(var(--chart-5))',
	],
};

const toDateKey = (value) => {
	if (!value) return '';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	return format(date, 'yyyy-MM-dd');
};

const AuditTooltip = ({ active, payload, label }) => {
	if (!active || !payload?.length) {
		return null;
	}

	return (
		<div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-lg">
			<p className="mb-1 font-medium text-foreground">{label || payload[0]?.name}</p>
			{payload.map((entry) => (
				<p key={entry.dataKey || entry.name} className="text-muted-foreground">
					<span className="font-medium text-foreground">{entry.name}: </span>
					{entry.value}
				</p>
			))}
		</div>
	);
};

export default function AdminActivityLogs() {
	const { user } = useAuth();
	const [search, setSearch] = useState('');
	const [entityFilter, setEntityFilter] = useState('all');
	const [severityFilter, setSeverityFilter] = useState('all');
	const canViewSummaryCards = isSuperAdmin(user);

	const { data: logs = [], isLoading, isFetching, refetch } = useQuery({
		queryKey: ['admin-activity-logs'],
		queryFn: () => baseClient.entities.ActivityLog.list('-created_date', 400),
		refetchInterval: 15000,
		refetchOnWindowFocus: true,
	});

	const entityOptions = useMemo(() => {
		const entities = Array.from(new Set(logs.map((log) => log.entity_type).filter(Boolean)));
		return entities.sort((left, right) => left.localeCompare(right));
	}, [logs]);

	const filteredLogs = useMemo(() => {
		return logs.filter((log) => {
			const severity = getActivityLogSeverity(log);
			const matchesQuery = matchesActivityLogSearch(log, search);

			const matchesEntity = entityFilter === 'all' || (log.entity_type || '') === entityFilter;
			const matchesSeverity = severityFilter === 'all' || severity === severityFilter;

			return matchesQuery && matchesEntity && matchesSeverity;
		});
	}, [logs, search, entityFilter, severityFilter]);

	const auditStats = useMemo(() => {
		const uniqueActors = new Set(filteredLogs.map((log) => log.user_email || log.user_name).filter(Boolean));
		const highSeverity = filteredLogs.filter((log) => getActivityLogSeverity(log) === 'high').length;
		const changedEntities = new Set(filteredLogs.map((log) => log.entity_type).filter(Boolean));
		const latestLog = filteredLogs[0]?.created_date ? new Date(filteredLogs[0].created_date) : null;

		return {
			total: filteredLogs.length,
			highSeverity,
			uniqueActors: uniqueActors.size,
			changedEntities: changedEntities.size,
			latestLabel: latestLog && !Number.isNaN(latestLog.getTime())
				? formatDistanceToNow(latestLog, { addSuffix: true })
				: 'No recent activity',
		};
	}, [filteredLogs]);

	const activityTrendData = useMemo(() => {
		const today = new Date();

		return Array.from({ length: 7 }, (_, index) => {
			const date = subDays(today, 6 - index);
			const key = toDateKey(date);
			const dayLogs = filteredLogs.filter((log) => toDateKey(log.created_date) === key);

			return {
				label: format(date, 'MMM d'),
				total: dayLogs.length,
				high: dayLogs.filter((log) => getActivityLogSeverity(log) === 'high').length,
				medium: dayLogs.filter((log) => getActivityLogSeverity(log) === 'medium').length,
				low: dayLogs.filter((log) => getActivityLogSeverity(log) === 'low').length,
			};
		});
	}, [filteredLogs]);

	const severityChartData = useMemo(() => (
		['high', 'medium', 'low'].map((severity) => ({
			name: severity,
			value: filteredLogs.filter((log) => getActivityLogSeverity(log) === severity).length,
		})).filter((item) => item.value > 0)
	), [filteredLogs]);

	const entityChartData = useMemo(() => {
		const counts = filteredLogs.reduce((acc, log) => {
			const entity = log.entity_type || 'Unknown';
			acc[entity] = (acc[entity] || 0) + 1;
			return acc;
		}, {});

		return Object.entries(counts)
			.map(([entity, count]) => ({ entity, count }))
			.sort((left, right) => right.count - left.count)
			.slice(0, 6);
	}, [filteredLogs]);

	return (
		<div className="w-full max-w-none space-y-6 px-2 py-6 sm:px-3 lg:px-4">
			<div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
				<div className="grid gap-6 border-b border-border bg-gradient-to-br from-primary/10 via-card to-secondary/10 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
					<div>
						<div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
							<ShieldCheck className="h-3.5 w-3.5" />
							Audit center
						</div>
						<h1 className="font-display text-3xl font-bold text-foreground">Audit Logs Monitoring</h1>
						<p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
							Monitor user actions, booking updates, system changes, and severity patterns in near real time.
						</p>
					</div>
					<Button type="button" variant="outline" className="gap-2 bg-background/80" onClick={() => refetch()} disabled={isFetching}>
						<RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
						Refresh
					</Button>
				</div>

				<div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
					{[
						{ label: 'Filtered logs', value: auditStats.total, helper: `${logs.length} loaded`, icon: Activity, tone: 'text-foreground' },
						{ label: 'High severity', value: auditStats.highSeverity, helper: 'Needs attention', icon: ShieldAlert, tone: 'text-destructive' },
						{ label: 'Unique actors', value: auditStats.uniqueActors, helper: 'Users or staff', icon: Users, tone: 'text-primary' },
						{ label: 'Entities changed', value: auditStats.changedEntities, helper: auditStats.latestLabel, icon: BarChart3, tone: 'text-secondary' },
					].map(({ label, value, helper, icon: Icon, tone }) => (
						<div key={label} className="rounded-lg border border-border bg-background p-4">
							<div className="flex items-center justify-between gap-3">
								<p className="text-sm text-muted-foreground">{label}</p>
								<Icon className={`h-4 w-4 ${tone}`} />
							</div>
							<p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p>
							<p className="mt-1 text-xs text-muted-foreground">{helper}</p>
						</div>
					))}
				</div>
			</div>

			{canViewSummaryCards ? <ActivityLogSummaryCards logs={logs} /> : null}

			<div className="grid gap-3 md:grid-cols-[1fr_220px_220px]">
				<div>
					<div className="relative">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Search by user, action, entity, or details..."
							className="pl-10"
						/>
					</div>
				</div>
				<Select value={entityFilter} onValueChange={setEntityFilter}>
					<SelectTrigger>
						<SelectValue placeholder="All Entities" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Entities</SelectItem>
						{entityOptions.map((entity) => (
							<SelectItem key={entity} value={entity}>{entity}</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select value={severityFilter} onValueChange={setSeverityFilter}>
					<SelectTrigger>
						<SelectValue placeholder="All Severity" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Severity</SelectItem>
						<SelectItem value="high">High</SelectItem>
						<SelectItem value="medium">Medium</SelectItem>
						<SelectItem value="low">Low</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{isLoading ? null : (
				<div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
					<Card className="border-border/80 shadow-sm">
						<CardHeader className="pb-3">
							<CardTitle className="font-display text-xl">Audit Activity Trend</CardTitle>
							<p className="text-sm text-muted-foreground">Filtered audit volume over the last 7 days.</p>
						</CardHeader>
						<CardContent>
							<div className="h-80">
								<ResponsiveContainer width="100%" height="100%">
									<LineChart data={activityTrendData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
										<CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
										<XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
										<YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
										<Tooltip content={<AuditTooltip />} />
										<Line type="monotone" dataKey="total" name="Total logs" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 3 }} />
										<Line type="monotone" dataKey="high" name="High severity" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
									</LineChart>
								</ResponsiveContainer>
							</div>
						</CardContent>
					</Card>

					<Card className="border-border/80 shadow-sm">
						<CardHeader className="pb-3">
							<CardTitle className="font-display text-xl">Severity Mix</CardTitle>
							<p className="text-sm text-muted-foreground">Risk level of the filtered log set.</p>
						</CardHeader>
						<CardContent>
							<div className="h-72">
								{severityChartData.length ? (
									<ResponsiveContainer width="100%" height="100%">
										<PieChart>
											<Pie data={severityChartData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={96} paddingAngle={3}>
												{severityChartData.map((item) => (
													<Cell key={item.name} fill={chartColors[item.name]} />
												))}
											</Pie>
											<Tooltip content={<AuditTooltip />} />
										</PieChart>
									</ResponsiveContainer>
								) : (
									<div className="flex h-full items-center justify-center text-sm text-muted-foreground">No severity data to chart.</div>
								)}
							</div>
							<div className="grid gap-2">
								{severityChartData.map((item) => (
									<div key={item.name} className="flex items-center justify-between text-sm">
										<span className="flex items-center gap-2 capitalize text-muted-foreground">
											<span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartColors[item.name] }} />
											{item.name}
										</span>
										<span className="font-semibold text-foreground">{item.value}</span>
									</div>
								))}
							</div>
						</CardContent>
					</Card>

					<Card className="border-border/80 shadow-sm xl:col-span-2">
						<CardHeader className="pb-3">
							<CardTitle className="font-display text-xl">Entity Activity Distribution</CardTitle>
							<p className="text-sm text-muted-foreground">Most frequently affected modules or records in the filtered audit trail.</p>
						</CardHeader>
						<CardContent>
							<div className="h-72">
								{entityChartData.length ? (
									<ResponsiveContainer width="100%" height="100%">
										<BarChart data={entityChartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
											<CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
											<XAxis dataKey="entity" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" interval={0} />
											<YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
											<Tooltip content={<AuditTooltip />} />
											<Bar dataKey="count" name="Logs" radius={[6, 6, 0, 0]}>
												{entityChartData.map((item, index) => (
													<Cell key={item.entity} fill={chartColors.entity[index % chartColors.entity.length]} />
												))}
											</Bar>
										</BarChart>
									</ResponsiveContainer>
								) : (
									<div className="flex h-full items-center justify-center text-sm text-muted-foreground">No entity data to chart.</div>
								)}
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			{isLoading ? (
				<div className="flex justify-center py-20">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
				</div>
			) : (
				<Card className="border-border/80 shadow-sm">
					<CardHeader className="border-b border-border pb-4">
						<CardTitle className="font-display text-xl">Audit Trail</CardTitle>
						<p className="text-sm text-muted-foreground">Showing {filteredLogs.length} filtered log{filteredLogs.length === 1 ? '' : 's'} from {logs.length} loaded records.</p>
					</CardHeader>
					<CardContent className="overflow-x-auto p-0 text-foreground">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Date</TableHead>
									<TableHead>When</TableHead>
									<TableHead>Severity</TableHead>
									<TableHead>User</TableHead>
									<TableHead>Action</TableHead>
									<TableHead>Entity</TableHead>
									<TableHead>Details</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody className="text-foreground">
								{filteredLogs.length === 0 ? (
									<TableRow>
										<TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
											No activity logs found.
										</TableCell>
									</TableRow>
								) : (
									filteredLogs.map((log) => (
										<TableRow key={log.id}>
											<TableCell className="whitespace-nowrap text-sm">
												{log.created_date ? format(new Date(log.created_date), 'MMM d, yyyy h:mm a') : 'Unknown'}
											</TableCell>
											<TableCell className="whitespace-nowrap text-xs text-muted-foreground">
												{log.created_date ? `${formatDistanceToNow(new Date(log.created_date), { addSuffix: true })}` : 'Unknown'}
											</TableCell>
											<TableCell className="max-w-md text-sm">
												<Badge variant="outline" className={activityLogSeverityStyles[getActivityLogSeverity(log)]}>
													{getActivityLogSeverity(log)}
												</Badge>
											</TableCell>
											<TableCell>
												<div>
													<p className="font-medium text-sm">{log.user_name || 'Unknown User'}</p>
													<p className="text-xs text-muted-foreground">{log.user_email || 'No email'}</p>
												</div>
											</TableCell>
											<TableCell className="min-w-44 font-medium">{log.action}</TableCell>
											<TableCell>
												<div>
													<p>{log.entity_type || 'Unknown'}</p>
													<p className="text-xs font-mono text-muted-foreground">{log.entity_id || 'No ID'}</p>
												</div>
											</TableCell>
											<TableCell className="max-w-md text-sm leading-6 text-muted-foreground">{log.details || 'No details provided.'}</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
