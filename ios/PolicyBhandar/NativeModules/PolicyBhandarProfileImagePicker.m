#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(PolicyBhandarProfileImagePicker, NSObject)

RCT_EXTERN_METHOD(pickImage:(RCTPromiseResolveBlock)resolve
                  withRejecter:(RCTPromiseRejectBlock)reject)

@end
