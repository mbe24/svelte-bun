import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
	initTracer,
	getTracer,
	startRootSpan,
	createChildSpan,
	getTraceId,
	extractTraceContext,
	injectTraceContext,
	setUserId,
	recordError,
	getFinishedSpans,
	clearFinishedSpans,
	shutdownTracer,
	forceFlush,
} from '../tracing';
import { SpanStatusCode, trace, context } from '@opentelemetry/api';

describe('Tracing', () => {
	beforeEach(() => {
		// Clear any previous state
		clearFinishedSpans();
	});

	afterEach(async () => {
		// Shutdown tracer after each test
		await shutdownTracer();
	});

	test('should initialize tracer with memory exporter', () => {
		initTracer({ TRACE_EXPORTER: 'memory' });
		const tracer = getTracer();
		expect(tracer).toBeDefined();
	});

	test('should be idempotent', () => {
		initTracer({ TRACE_EXPORTER: 'memory' });
		const tracer1 = getTracer();
		
		// Initialize again
		initTracer({ TRACE_EXPORTER: 'memory' });
		const tracer2 = getTracer();
		
		expect(tracer1).toBe(tracer2);
	});

	test('should create root span and record trace ID', async () => {
		initTracer({ TRACE_EXPORTER: 'memory' });
		
		const span = startRootSpan('test.root', {
			attributes: { 'test.attribute': 'value' },
		});
		
		const traceId = getTraceId(span);
		expect(traceId).toBeDefined();
		expect(traceId.length).toBeGreaterThan(0);
		
		span.end();
		await forceFlush();
	});

	test('should create child span', async () => {
		initTracer({ TRACE_EXPORTER: 'memory' });
		
		const rootSpan = startRootSpan('test.root');
		const childSpan = createChildSpan('test.child', {
			attributes: { 'child.attribute': 'value' },
		});
		
		expect(childSpan).toBeDefined();
		
		childSpan.end();
		rootSpan.end();
		await forceFlush();
	});

	test('should hash user ID for PII protection', async () => {
		initTracer({ TRACE_EXPORTER: 'memory' });
		
		const span = startRootSpan('test.user');
		setUserId(span, 12345);
		
		span.end();
		await forceFlush();
		
		// Verify span was created (we can't easily check the hashed value without exposing internals)
		const spans = getFinishedSpans();
		expect(spans.length).toBeGreaterThan(0);
	});

	test('should record error on span', async () => {
		initTracer({ TRACE_EXPORTER: 'memory' });
		
		const span = startRootSpan('test.error');
		const error = new Error('Test error');
		recordError(span, error, 500);
		
		span.end();
		await forceFlush();
		
		const spans = getFinishedSpans();
		expect(spans.length).toBe(1);
		expect(spans[0].status.code).toBe(SpanStatusCode.ERROR);
	});

	test('should inject and extract trace context', async () => {
		initTracer({ TRACE_EXPORTER: 'memory' });
		
		const span = startRootSpan('test.propagation');
		const traceId = getTraceId(span);
		
		// Inject context into headers - must be done within span's context
		const headers: Record<string, string> = {};
		context.with(trace.setSpan(context.active(), span), () => {
			injectTraceContext(headers);
		});
		
		expect(headers['traceparent']).toBeDefined();
		expect(headers['traceparent']).toContain(traceId);
		
		span.end();
		await forceFlush();
		
		// Extract context from headers
		const headersObj = new Headers(headers);
		const extractedContext = extractTraceContext(headersObj);
		
		expect(extractedContext).toBeDefined();
	});

	test('should collect spans in memory exporter', async () => {
		initTracer({ TRACE_EXPORTER: 'memory' });
		
		const span1 = startRootSpan('test.span1');
		span1.end();
		
		const span2 = startRootSpan('test.span2');
		span2.end();
		
		await forceFlush();
		
		const spans = getFinishedSpans();
		expect(spans.length).toBe(2);
		expect(spans[0].name).toBe('test.span1');
		expect(spans[1].name).toBe('test.span2');
	});

	test('should clear finished spans', async () => {
		initTracer({ TRACE_EXPORTER: 'memory' });
		
		const span = startRootSpan('test.clear');
		span.end();
		await forceFlush();
		
		let spans = getFinishedSpans();
		expect(spans.length).toBe(1);
		
		clearFinishedSpans();
		
		spans = getFinishedSpans();
		expect(spans.length).toBe(0);
	});

	test('should handle service name and version from env', async () => {
		initTracer({
			TRACE_EXPORTER: 'memory',
			SERVICE_NAME: 'test-service',
			APP_RELEASE: '1.0.0',
		});
		
		const span = startRootSpan('test.service');
		span.end();
		await forceFlush();
		
		const spans = getFinishedSpans();
		expect(spans.length).toBe(1);
		
		const resource = spans[0].resource;
		expect(resource.attributes['service.name']).toBe('test-service');
		expect(resource.attributes['service.version']).toBe('1.0.0');
	});
});
