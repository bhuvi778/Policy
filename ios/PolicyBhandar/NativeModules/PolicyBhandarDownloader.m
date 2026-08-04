#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(PolicyBhandarDownloader, NSObject)

RCT_EXTERN_METHOD(download:(NSString *)url
                  withFileName:(NSString *)fileName
                  withMimeType:(NSString *)mimeType
                  withResolver:(RCTPromiseResolveBlock)resolve
                  withRejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(shareFile:(NSString *)url
                  withFileName:(NSString *)fileName
                  withMimeType:(NSString *)mimeType
                  withMessage:(NSString *)message
                  withWhatsappOnly:(BOOL)whatsappOnly
                  withResolver:(RCTPromiseResolveBlock)resolve
                  withRejecter:(RCTPromiseRejectBlock)reject)

@end
