# pip install nfcpy
# 仅示例：读取卡片 UID 并打印；不要写卡或尝试破解。
import nfc

def on_connect(tag):
    try:
        uid = tag.identifier.hex().upper()
    except Exception:
        uid = 'UNKNOWN'
    print("UID:", uid)
    return True  # disconnect immediately

if __name__ == "__main__":
    clf = nfc.ContactlessFrontend('usb')
    print("请将卡片靠近读卡器... Ctrl+C 退出")
    try:
        while True:
            clf.connect(rdwr={'on-connect': on_connect})
    except KeyboardInterrupt:
        pass
    finally:
        clf.close()
