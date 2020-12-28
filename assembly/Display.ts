export interface DisplayMode {
  // constructor(video: VideoProcessor): DisplayMode;

  lineHandler(line: u8): void;
}
