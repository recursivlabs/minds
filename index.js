// Custom app entry. Registers the native audio playback service (track-player)
// before the router mounts so background/lockscreen audio is ready; on web this
// import resolves to a no-op (registerPlayback.ts), keeping track-player out of
// the web bundle. Then hands off to expo-router's standard entry.
import './lib/audio/registerPlayback';

require('expo-router/entry');
