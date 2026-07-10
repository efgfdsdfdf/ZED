
console.log('Node version:', process.version);
console.log('fetch available:', typeof fetch !== 'undefined');
console.log('AbortSignal available:', typeof AbortSignal !== 'undefined');
if (typeof AbortSignal !== 'undefined') {
  console.log('AbortSignal.timeout available:', typeof AbortSignal.timeout !== 'undefined');
}
