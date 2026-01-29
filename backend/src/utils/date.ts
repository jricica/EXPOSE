export type DateInput = Date | number | string;

export type DurationInput = {
	days?: number;
	hours?: number;
	minutes?: number;
	seconds?: number;
	milliseconds?: number;
};

const MILLIS = {
	millisecond: 1,
	second: 1000,
	minute: 60_000,
	hour: 3_600_000,
	day: 86_400_000,
} as const;

const isFiniteNumber = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value);

export const now = (): Date => new Date();

export const toDate = (value?: DateInput, fallback?: Date): Date => {
	if (value instanceof Date) {
		return new Date(value.getTime());
	}

	if (typeof value === 'number') {
		return new Date(value);
	}

	if (typeof value === 'string') {
		const parsed = new Date(value);
		if (!Number.isNaN(parsed.getTime())) {
			return parsed;
		}
	}

	const fb = fallback ?? new Date();
	return new Date(fb.getTime());
};

const toMilliseconds = (amount: number | undefined, unit: number): number =>
	(isFiniteNumber(amount) ? amount : 0) * unit;

export const durationToMilliseconds = (
	duration: DurationInput = {}
): number =>
	toMilliseconds(duration.days, MILLIS.day) +
	toMilliseconds(duration.hours, MILLIS.hour) +
	toMilliseconds(duration.minutes, MILLIS.minute) +
	toMilliseconds(duration.seconds, MILLIS.second) +
	toMilliseconds(duration.milliseconds, MILLIS.millisecond);

export const durationIsPositive = (
	duration?: DurationInput | null
): boolean => durationToMilliseconds(duration ?? {}) > 0;

export const addDuration = (
	value: DateInput = now(),
	duration: DurationInput = {}
): Date => {
	const base = toDate(value);
	return new Date(base.getTime() + durationToMilliseconds(duration));
};

export const hasExpired = (
	expiresAt?: DateInput | null,
	reference: DateInput = now()
): boolean => {
	if (!expiresAt) return false;
	return (
		toDate(expiresAt).getTime() <=
		toDate(reference).getTime()
	);
};

export const ensureFutureDate = (
	expiresAt: DateInput,
	reference: DateInput = now()
): Date => {
	const expiration = toDate(expiresAt);
	const ref = toDate(reference);

	return expiration.getTime() <= ref.getTime()
		? new Date(ref.getTime() + 1)
		: expiration;
};
