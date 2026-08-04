#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(PolicyBhandarVisitingCardScanner, NSObject)

RCT_EXTERN_METHOD(processCardImage:(NSString *)photoPath
                  withFrameRatio:(double)frameRatio
                  withResolver:(RCTPromiseResolveBlock)resolve
                  withRejecter:(RCTPromiseRejectBlock)reject)

@end
