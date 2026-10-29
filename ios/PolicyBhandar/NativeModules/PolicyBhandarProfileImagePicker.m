#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(PolicyBhandarProfileImagePicker, NSObject)

RCT_EXTERN_METHOD(pickImage:(RCTPromiseResolveBlock)resolve
                  withRejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(prepareImage:(NSString *)uri withResolver:(RCTPromiseResolveBlock)resolve withRejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(cropImage:(NSString *)uri withX:(double)x withY:(double)y withWidth:(double)width withHeight:(double)height
                  withFitWholeImage:(BOOL)fitWholeImage withResolver:(RCTPromiseResolveBlock)resolve withRejecter:(RCTPromiseRejectBlock)reject)

@end
