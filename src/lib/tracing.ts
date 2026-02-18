/**
 * OpenTelemetry Tracing Module
 * 
 * Implements distributed tracing with OpenTelemetry, exporting traces to PostHog via OTLP.
 * Designed for Cloudflare Workers compatibility using fetch-based OTLP export.
 * 
 * Features:
 * - Idempotent tracer initialization
 * - Sampling: always keep error traces, configurable sampling for success
 * - Resource attributes: SERVICE_NAME, APP_RELEASE
 * - PII protection: hash user IDs before storing
 * - Memory exporter for testing
 */

import { 
	trace, 
	context, 
	SpanStatusCode, 
	type Span, 
	type SpanOptions,
	type Context,
	propagation,
	ROOT_CONTEXT
} from '@opentelemetry/api';
import { 
	BasicTracerProvider,
	BatchSpanProcessor,
	SimpleSpanProcessor,
	ConsoleSpanExporter,
	InMemorySpanExporter,
	type ReadableSpan,
	type SpanProcessor
} from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { getServiceName, getEnvironmentName } from './environment';

// Global tracer instance
let tracerProvider: BasicTracerProvider | null = null;
let memoryExporter: InMemorySpanExporter | null = null;
let isInitialized = false;

// Constants
const TRACER_NAME = 'svelte-bun-tracer';
const DEFAULT_SAMPLE_RATE = 0.1;

/**
 * Hash function for PII protection
 */
function hashString(input: string): string {
	// Simple hash for PII protection - in production, consider using crypto.subtle
	let hash = 0;
	for (let i = 0; i < input.length; i++) {
		const char = input.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash; // Convert to 32bit integer
	}
	return Math.abs(hash).toString(36);
}

/**
 * Sampling function: always keep errors, sample success by rate
 */
function shouldSample(isError: boolean, sampleRate: number): boolean {
	if (isError) return true;
	return Math.random() < sampleRate;
}

/**
 * Get OTLP base endpoint for PostHog traces
 * 
 * This function returns the base URL without path suffix, matching the pattern
 * used in telemetry.ts. The path suffix (/v1/traces) is appended when creating
 * the exporter.
 * 
 * This function:
 * - Returns POSTHOG_OTLP_HOST if explicitly set (base URL without path)
 * - Otherwise, automatically derives base endpoint from POSTHOG_HOST
 * - Falls back to US ingestion endpoint if mapping fails
 */
function getOTLPTraceEndpoint(posthogHost: string, posthogOtlpHost?: string): string {
	// If OTLP host is explicitly set and not empty, use it as-is
	if (posthogOtlpHost && posthogOtlpHost.length > 0) {
		return posthogOtlpHost;
	}
	
	// Otherwise, derive from posthogHost
	try {
		const url = new URL(posthogHost);
		const hostname = url.hostname.toLowerCase();
		
		// If already using ingestion endpoint, return as-is
		if (hostname.includes('.i.posthog.com')) {
			return posthogHost;
		}
		
		// Map dashboard URLs to OTLP ingestion base endpoints
		if (hostname === 'eu.posthog.com' || hostname === 'app.eu.posthog.com') {
			return 'https://eu.i.posthog.com';
		}
		
		if (hostname === 'app.posthog.com' || hostname === 'us.posthog.com' || hostname === 'posthog.com') {
			return 'https://us.i.posthog.com';
		}
		
		// For self-hosted, assume OTLP is at same host
		return posthogHost;
	} catch (e) {
		console.warn('[Tracing] Failed to parse PostHog host URL:', posthogHost, e);
		return 'https://us.i.posthog.com';
	}
}

/**
 * Initialize OpenTelemetry tracer (idempotent)
 */
export function initTracer(env?: {
	POSTHOG_API_KEY?: string;
	POSTHOG_HOST?: string;
	POSTHOG_OTLP_HOST?: string;
	TRACE_SUCCESS_SAMPLE_RATE?: string;
	SERVICE_NAME?: string;
	APP_RELEASE?: string;
	TRACE_EXPORTER?: string;
	OTLP_HEADERS?: string;
	ENVIRONMENT?: string;
	CF_PAGES_BRANCH?: string;
}): void {
	if (isInitialized && tracerProvider) {
		return; // Already initialized
	}

	// Determine exporter type
	const exporterType = env?.TRACE_EXPORTER?.toLowerCase() || 'otlp';
	
	// Create resource with service info
	// Use getServiceName to derive from ENVIRONMENT/CF_PAGES_BRANCH, 
	// or fall back to SERVICE_NAME if explicitly set
	const serviceName = env?.SERVICE_NAME || getServiceName(env);
	// Use APP_RELEASE if set, otherwise default to ENVIRONMENT name
	const serviceVersion = env?.APP_RELEASE || getEnvironmentName(env);
	
	// Create resource with service info
	const resource = new Resource({
		[ATTR_SERVICE_NAME]: serviceName,
		[ATTR_SERVICE_VERSION]: serviceVersion,
	});

	// Setup span processor based on exporter type
	let spanProcessor: SpanProcessor;
	
	if (exporterType === 'memory') {
		// Memory exporter for testing
		// Use SimpleSpanProcessor for immediate, synchronous export (no batching)
		memoryExporter = new InMemorySpanExporter();
		spanProcessor = new SimpleSpanProcessor(memoryExporter);
		console.log('[Tracing] Initialized with memory exporter for testing');
	} else if (exporterType === 'console') {
		// Console exporter for debugging
		spanProcessor = new BatchSpanProcessor(new ConsoleSpanExporter());
		console.log('[Tracing] Initialized with console exporter for debugging');
	} else {
		// OTLP exporter for PostHog
		const posthogHost = env?.POSTHOG_HOST || 'https://app.posthog.com';
		const posthogApiKey = env?.POSTHOG_API_KEY;
		
		if (posthogApiKey) {
			const baseEndpoint = getOTLPTraceEndpoint(posthogHost, env?.POSTHOG_OTLP_HOST);
			// Append path suffix to base endpoint, matching pattern in telemetry.ts
			const endpoint = `${baseEndpoint}/v1/traces`;
			
			// Parse additional OTLP headers if provided
			let headers: Record<string, string> = {
				'Authorization': `Bearer ${posthogApiKey}`,
			};
			
			if (env?.OTLP_HEADERS) {
				try {
					const additionalHeaders = JSON.parse(env.OTLP_HEADERS);
					headers = { ...headers, ...additionalHeaders };
				} catch (e) {
					console.warn('[Tracing] Failed to parse OTLP_HEADERS:', e);
				}
			}
			
			const otlpExporter = new OTLPTraceExporter({
				url: endpoint,
				headers,
			});
			
			spanProcessor = new BatchSpanProcessor(otlpExporter);
			console.log('[Tracing] Initialized with OTLP exporter to', endpoint);
		} else {
			console.warn('[Tracing] No POSTHOG_API_KEY provided, tracing disabled');
			// Create a no-op processor
			spanProcessor = new SimpleSpanProcessor(new InMemorySpanExporter());
		}
	}

	// Create a custom tracer provider that extends BasicTracerProvider
	// BasicTracerProvider is the correct choice for Cloudflare Workers (not Node or Web specific)
	tracerProvider = new (class extends BasicTracerProvider {
		constructor() {
			super({ resource });
			// Register span processor using internal API
			if (spanProcessor) {
				(this as any).addSpanProcessor(spanProcessor);
			}
		}
	})();

	// Set up W3C trace context propagation
	propagation.setGlobalPropagator(new W3CTraceContextPropagator());

	// Set the global tracer provider
	trace.setGlobalTracerProvider(tracerProvider);

	isInitialized = true;
}

/**
 * Get the global tracer
 */
export function getTracer() {
	if (!isInitialized) {
		console.warn('[Tracing] Tracer not initialized, initializing with defaults');
		initTracer();
	}
	return trace.getTracer(TRACER_NAME);
}

/**
 * Start a root span for an incoming HTTP request
 */
export function startRootSpan(
	name: string,
	options: SpanOptions = {},
	parentContext?: Context
): Span {
	const tracer = getTracer();
	const ctx = parentContext || ROOT_CONTEXT;
	return tracer.startSpan(name, options, ctx);
}

/**
 * Create a child span within the current active context
 */
export function createChildSpan(
	name: string,
	options: SpanOptions = {}
): Span {
	const tracer = getTracer();
	return tracer.startSpan(name, options);
}

/**
 * Get trace ID from current span or a specific span
 */
export function getTraceId(span?: Span): string {
	const activeSpan = span || trace.getActiveSpan();
	if (!activeSpan) {
		return '';
	}
	return activeSpan.spanContext().traceId;
}

/**
 * Get span ID from current span or a specific span
 */
export function getSpanId(span?: Span): string {
	const activeSpan = span || trace.getActiveSpan();
	if (!activeSpan) {
		return '';
	}
	return activeSpan.spanContext().spanId;
}

/**
 * Extract trace context from HTTP headers (incoming request)
 */
export function extractTraceContext(headers: Headers): Context {
	return propagation.extract(ROOT_CONTEXT, headers, {
		get: (carrier, key) => carrier.get(key) || undefined,
		keys: (carrier) => Array.from(carrier.keys()),
	});
}

/**
 * Inject trace context into HTTP headers (outgoing request)
 */
export function injectTraceContext(headers: Record<string, string>, ctx?: Context): void {
	const activeContext = ctx || context.active();
	propagation.inject(activeContext, headers, {
		set: (carrier, key, value) => {
			carrier[key] = value;
		},
	});
}

/**
 * Set user ID on span with PII protection
 */
export function setUserId(span: Span, userId: number | string): void {
	const hashedUserId = hashString(String(userId));
	span.setAttribute('enduser.id', hashedUserId);
	// Keep original in internal attribute for debugging (if needed)
	// span.setAttribute('internal.user_id', userId);
}

/**
 * Mark span as error and record exception
 */
export function recordError(span: Span, error: Error | string, statusCode?: number): void {
	span.setStatus({
		code: SpanStatusCode.ERROR,
		message: typeof error === 'string' ? error : error.message,
	});
	
	if (typeof error !== 'string') {
		span.recordException(error);
	}
	
	if (statusCode) {
		span.setAttribute('http.status_code', statusCode);
	}
}

/**
 * Execute a function within a span context
 */
export async function withSpan<T>(
	span: Span,
	fn: () => Promise<T>
): Promise<T> {
	return context.with(trace.setSpan(context.active(), span), async () => {
		try {
			const result = await fn();
			return result;
		} catch (error) {
			recordError(span, error as Error);
			throw error;
		} finally {
			span.end();
		}
	});
}

/**
 * Get finished spans from memory exporter (for testing)
 */
export function getFinishedSpans(): ReadableSpan[] {
	if (!memoryExporter) {
		return [];
	}
	return memoryExporter.getFinishedSpans();
}

/**
 * Clear finished spans from memory exporter (for testing)
 */
export function clearFinishedSpans(): void {
	if (memoryExporter) {
		memoryExporter.reset();
	}
}

/**
 * Shutdown tracer and flush pending spans
 */
export async function shutdownTracer(): Promise<void> {
	if (tracerProvider) {
		await tracerProvider.shutdown();
		tracerProvider = null;
		isInitialized = false;
		memoryExporter = null;
	}
}

/**
 * Force flush pending spans (useful before response)
 */
export async function forceFlush(): Promise<void> {
	if (tracerProvider) {
		await tracerProvider.forceFlush();
	}
}

/**
 * Wrap a database operation with tracing
 */
export async function traceDatabaseOperation<T>(
	operationName: string,
	table: string,
	queryType: string,
	fn: () => Promise<T>,
	userId?: number
): Promise<T> {
	const span = createChildSpan(`db.query.${table}`, {
		attributes: {
			'db.system': 'postgresql',
			'db.operation': queryType,
			'db.table': table,
		},
	});

	if (userId) {
		setUserId(span, userId);
	}

	try {
		const result = await fn();
		span.setStatus({ code: SpanStatusCode.OK });
		return result;
	} catch (error) {
		recordError(span, error as Error);
		throw error;
	} finally {
		span.end();
	}
}

/**
 * Wrap an external HTTP call with tracing
 */
export async function traceExternalCall(
	url: string,
	method: string,
	fn: () => Promise<Response>
): Promise<Response> {
	const span = createChildSpan(`http.client.${method}`, {
		attributes: {
			'http.method': method,
			'http.url': url,
			'span.kind': 'client',
		},
	});

	try {
		const response = await fn();
		span.setAttribute('http.status_code', response.status);
		
		if (response.ok) {
			span.setStatus({ code: SpanStatusCode.OK });
		} else {
			span.setStatus({ 
				code: SpanStatusCode.ERROR,
				message: `HTTP ${response.status}` 
			});
		}
		
		return response;
	} catch (error) {
		recordError(span, error as Error);
		throw error;
	} finally {
		span.end();
	}
}

/**
 * Helper to determine if sampling should be applied
 */
export function getSampleRate(env?: { TRACE_SUCCESS_SAMPLE_RATE?: string }): number {
	const rate = parseFloat(env?.TRACE_SUCCESS_SAMPLE_RATE || String(DEFAULT_SAMPLE_RATE));
	return isNaN(rate) ? DEFAULT_SAMPLE_RATE : Math.max(0, Math.min(1, rate));
}
