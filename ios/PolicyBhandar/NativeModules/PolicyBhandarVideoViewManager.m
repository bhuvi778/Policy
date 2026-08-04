#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(PolicyBhandarVideoViewManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(source, NSString)
RCT_EXPORT_VIEW_PROPERTY(thumbnailMode, BOOL)
RCT_EXPORT_VIEW_PROPERTY(onVideoLoadStart, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onVideoReady, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onVideoError, RCTDirectEventBlock)

@end
