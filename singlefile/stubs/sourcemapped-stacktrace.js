// Replacement for sourcemapped-stacktrace used by the single-file build.
//
// The library works by downloading the .map files that belong to the scripts
// in a stack trace. A standalone HTML document has a single inline <script>
// and no source maps at all, so all it could do is fail. Pass the stack
// through untouched instead.
export function mapStackTrace(stack, done) {
  if (typeof done !== 'function') {
    return;
  }
  if (typeof stack === 'string') {
    done(stack.split('\n'));
  } else if (Array.isArray(stack)) {
    done(stack);
  } else {
    done([]);
  }
}

export function mapStackTraceForImage() {
  throw new Error('mapStackTraceForImage is not available in the single-file build');
}

export default { mapStackTrace, mapStackTraceForImage };
