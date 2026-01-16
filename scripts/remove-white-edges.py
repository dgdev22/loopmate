#!/usr/bin/env python3
"""
PNG 이미지의 가장자리 반투명한 하얀색을 완전히 투명하게 만드는 스크립트
"""
from PIL import Image
import sys
import os

def remove_white_edges(input_path, output_path=None, threshold=240):
    """
    이미지의 가장자리 반투명한 하얀색을 완전히 투명하게 만듭니다.
    
    Args:
        input_path: 입력 PNG 파일 경로
        output_path: 출력 PNG 파일 경로 (None이면 원본 덮어쓰기)
        threshold: 하얀색으로 간주할 RGB 임계값 (0-255, 기본값 240)
    """
    if output_path is None:
        output_path = input_path
    
    # 이미지 열기
    img = Image.open(input_path).convert("RGBA")
    pixels = img.load()
    width, height = img.size
    
    # 각 픽셀을 확인하여 반투명한 하얀색 또는 하얀색에 가까운 픽셀을 완전히 투명하게 만들기
    transparent_count = 0
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            
            # 하얀색에 가까운 경우 (RGB 값이 모두 임계값 이상) - 반투명 여부와 관계없이
            if r >= threshold and g >= threshold and b >= threshold:
                # 밝기가 임계값 이상인 모든 하얀색 픽셀을 투명하게
                pixels[x, y] = (0, 0, 0, 0)  # 완전히 투명
                transparent_count += 1
            # 또는 평균 밝기가 임계값 이상인 경우도 투명하게
            elif (r + g + b) / 3 >= threshold:
                pixels[x, y] = (0, 0, 0, 0)
                transparent_count += 1
            # 또는 반투명한 픽셀 중 밝은 색상도 투명하게
            elif a < 255 and (r + g + b) / 3 >= threshold * 0.85:
                pixels[x, y] = (0, 0, 0, 0)
                transparent_count += 1
    
    # 수정된 이미지 저장
    img.save(output_path, "PNG", optimize=True)
    print(f"✅ 처리 완료: {transparent_count}개의 픽셀을 투명하게 변경했습니다.")
    print(f"✅ 저장 위치: {output_path}")
    return transparent_count

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("사용법: python3 remove-white-edges.py <input.png> [output.png] [threshold]")
        print("예시: python3 remove-white-edges.py build/icon.png build/icon_fixed.png 240")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None
    threshold = int(sys.argv[3]) if len(sys.argv) > 3 else 240
    
    if not os.path.exists(input_path):
        print(f"❌ 오류: 파일을 찾을 수 없습니다: {input_path}")
        sys.exit(1)
    
    try:
        remove_white_edges(input_path, output_path, threshold)
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        sys.exit(1)
