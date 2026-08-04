#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(PolicyBhandarClipboard, NSObject)

RCT_EXTERN_METHOD(copyText:(NSString *)text
                  withResolver:(RCTPromiseResolveBlock)resolve
                  withRejecter:(RCTPromiseRejectBlock)reject)

@end
