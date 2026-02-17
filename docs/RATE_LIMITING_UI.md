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

The error message includes a dynamic countdown timer based on when the oldest request will slide out of the window:
```typescript
// Use server-provided retryAfter
const waitSeconds = data.retryAfter || 10;
rateLimitError = `Too many actions. Please wait ${waitSeconds} seconds before trying again.`;
```

**How it works:**
The server calculates `retryAfter` from the `reset` timestamp provided by Upstash's sliding window rate limiter. The `reset` timestamp indicates when the oldest request will slide out of the 10-second window, allowing a new request. This means:
- If you make 3 requests at t=0s, t=1s, t=2s and hit the limit at t=3s, you wait 7 seconds (until t=10s when the first request slides out)
- If you make 3 requests at t=5s, t=6s, t=7s and hit the limit at t=8s, you wait 7 seconds (until t=15s when the first request slides out)
- The wait time varies based on when your oldest request was made, reflecting true sliding window behavior

## User Experience Flow

1. User clicks increment/decrement button (1st time) → ✅ Success
2. User clicks again (2nd time) → ✅ Success
3. User clicks again (3rd time) → ✅ Success
4. User clicks again (4th time within 10 seconds) → ❌ Rate limited
   - Error message appears below buttons
   - Message shows the actual wait time (e.g., "Please wait 7 seconds before trying again.")
5. User waits for the countdown
6. User can click again → ✅ Success

## Error Message Text Examples

- Initial display: "Too many actions. Please wait before trying again."
- With countdown: "Too many actions. Please wait 7 seconds before trying again." (varies based on sliding window)

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
    
    // Use server-provided retryAfter
    const waitSeconds = data.retryAfter || 10;
    rateLimitError = `Too many actions. Please wait ${waitSeconds} seconds before trying again.`;
    
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
  "remaining": 0,
  "retryAfter": 7
}
```

- `Retry-After` header: HTTP standard header indicating seconds to wait (RFC 6585)
- `retryAfter`: Calculated from Upstash's `reset` timestamp - indicates when the oldest request slides out of the window
- `remaining`: Number of remaining requests in current window

## Accessibility Considerations

- Error message uses semantic HTML
- Color contrast meets WCAG AA standards (dark red on light pink)
- Font size is readable (0.9rem)
- Message is clear and actionable
- Dynamic wait time accurately reflects sliding window behavior

## Testing Scenarios

1. **Test Rate Limit Trigger**: Click increment 4 times rapidly → should see error after 3rd click
2. **Test Wait Time Display**: Verify message shows accurate wait time based on sliding window
3. **Test Auto-Dismiss**: Wait 10 seconds → error should disappear
4. **Test Clear on New Action**: Click button after cooldown → error should clear
5. **Test Memory Leak**: Navigate away during countdown → no console errors
6. **Test Sliding Window**: Make requests at different intervals and verify wait times vary accordingly

## Future Enhancements (Optional)

- Add a visual progress bar showing remaining time
- Disable buttons during rate limit period
- Add a "requests remaining" counter (e.g., "2/3 actions left")
- Add haptic feedback on mobile devices
- Sound notification when rate limit is lifted
