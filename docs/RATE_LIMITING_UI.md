# Rate Limiting UI Changes

## Overview

This document describes the UI changes made to support rate limiting in the counter application.

## Visual Representation

### Normal State (Before Rate Limit)
```
┌─────────────────────────────────────────────┐
│  Counter App                      [Logout]  │
├─────────────────────────────────────────────┤
│                                             │
│                    5                        │
│                                             │
│            [ − ]       [ + ]                │
│                                             │
└─────────────────────────────────────────────┘
```

### Rate Limited State (After 3+ Actions in 10 Seconds)
```
┌─────────────────────────────────────────────┐
│  Counter App                      [Logout]  │
├─────────────────────────────────────────────┤
│                                             │
│                    5                        │
│                                             │
│            [ − ]       [ + ]                │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ ⚠️  Too many actions. Please wait   │   │
│  │     8 seconds before trying again.  │   │
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

## UI Implementation Details

### Error Message Component

The error message appears below the counter buttons when rate limit is exceeded:

**Styling:**
- Background: Light pink/red (`#fee`)
- Border: Solid pink (`#fcc`)
- Text: Dark red (`#c33`)
- Padding: 1rem
- Border radius: 0.5rem
- Font size: 0.9rem
- Font weight: 500 (medium)

**Behavior:**
1. **Display**: Shows immediately when rate limit is hit (429 response)
2. **Content**: Dynamic message with countdown timer
   - Example: "Too many actions. Please wait 8 seconds before trying again."
3. **Auto-dismiss**: Automatically clears after 10 seconds
4. **Clear on action**: Clears when user attempts a new action
5. **Memory safety**: Cleanup on component unmount to prevent memory leaks

### Button State

When rate limit is active:
- Buttons remain enabled (user can click)
- Error message appears on 429 response
- No visual change to buttons themselves

### Message Countdown

The error message includes a countdown timer calculated on the server side for accuracy:
```typescript
// Use retryAfter from server if available, otherwise calculate from reset
let waitSeconds = 0;
if (data.retryAfter) {
    // Server-calculated retry time (more accurate for sliding windows)
    waitSeconds = data.retryAfter;
} else if (data.reset) {
    // Fallback: calculate from reset timestamp
    const now = Date.now();
    const resetTime = data.reset;
    waitSeconds = Math.ceil((resetTime - now) / 1000);
}

if (waitSeconds > 0) {
    rateLimitError = `Too many actions. Please wait ${waitSeconds} seconds before trying again.`;
}
```

**Why server-side calculation?**
The Upstash sliding window implementation returns a `reset` timestamp that represents the end of the current window bucket (like a fixed window), not when the next request will actually be available. For sliding windows, this can lead to inaccurate wait times. The server-side calculation caps the wait time at the window duration (10 seconds) for more accurate user feedback.

## User Experience Flow

1. User clicks increment/decrement button (1st time) → ✅ Success
2. User clicks again (2nd time) → ✅ Success
3. User clicks again (3rd time) → ✅ Success
4. User clicks again (4th time within 10 seconds) → ❌ Rate limited
   - Error message appears below buttons
   - Message shows countdown timer
5. User waits for countdown to reach 0
6. User can click again → ✅ Success

## Error Message Text Examples

- Initial display: "Too many actions. Please wait before trying again."
- With countdown: "Too many actions. Please wait 8 seconds before trying again."
- Fallback: "Too many actions. Please wait before trying again." (if no reset timestamp)

## Technical Implementation

### State Management
```typescript
let rateLimitError = $state('');
let rateLimitTimeout: ReturnType<typeof setTimeout> | null = null;
```

### Lifecycle Hooks
```typescript
onDestroy(() => {
    // Clean up timeout to prevent memory leaks
    if (rateLimitTimeout) {
        clearTimeout(rateLimitTimeout);
    }
});
```

### API Response Handling
```typescript
if (response.status === 429) {
    const data = await response.json();
    rateLimitError = data.message;
    
    // Use server-provided retryAfter for accurate wait time
    // The server calculates this based on the sliding window duration
    // to avoid showing incorrect wait times caused by the reset timestamp
    let waitSeconds = data.retryAfter || 0;
    
    if (waitSeconds > 0) {
        rateLimitError = `Too many actions. Please wait ${waitSeconds} seconds before trying again.`;
    }
    
    // Auto-clear after 10 seconds
}
```

**API Response Format:**

**Headers:**
```
HTTP/1.1 429 Too Many Requests
Retry-After: 10
Content-Type: application/json
```

**Body:**
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many actions. Please wait before trying again.",
  "reset": 1234567890000,
  "remaining": 0,
  "retryAfter": 10
}
```

- `Retry-After` header: HTTP standard header indicating seconds to wait (RFC 6585)
- `retryAfter`: Server-calculated wait time in seconds (accurate for sliding windows)
- `reset`: Unix timestamp in milliseconds when limit resets (kept for backwards compatibility)
- `remaining`: Number of remaining requests in current window

## Accessibility Considerations

- Error message uses semantic HTML
- Color contrast meets WCAG AA standards (dark red on light pink)
- Font size is readable (0.9rem)
- Message is clear and actionable
- Countdown provides clear feedback on when to retry

## Testing Scenarios

1. **Test Rate Limit Trigger**: Click increment 4 times rapidly → should see error after 3rd click
2. **Test Countdown Display**: Verify countdown shows correct seconds
3. **Test Auto-Dismiss**: Wait 10 seconds → error should disappear
4. **Test Clear on New Action**: Click button after cooldown → error should clear
5. **Test Memory Leak**: Navigate away during countdown → no console errors

## Future Enhancements (Optional)

- Add a visual progress bar showing remaining time
- Disable buttons during rate limit period
- Add a "requests remaining" counter (e.g., "2/3 actions left")
- Add haptic feedback on mobile devices
- Sound notification when rate limit is lifted
