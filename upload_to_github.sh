#!/bin/bash

# 活动报名网站 - 上传到GitHub脚本
# 使用方法: ./upload_to_github.sh YOUR_GITHUB_USERNAME

if [ -z "$1" ]; then
    echo "错误: 请提供你的GitHub用户名"
    echo "使用方法: ./upload_to_github.sh YOUR_GITHUB_USERNAME"
    exit 1
fi

GITHUB_USERNAME=$1
REPO_NAME="活动报名网站"

echo "=== 准备上传到GitHub ==="
echo "仓库名称: $REPO_NAME"
echo "GitHub用户名: $GITHUB_USERNAME"
echo ""

# 检查是否已经有remote
if git remote | grep -q origin; then
    echo "检测到已存在origin remote，正在移除..."
    git remote remove origin
fi

# 添加remote
echo "添加GitHub remote..."
git remote add origin "https://github.com/$GITHUB_USERNAME/$REPO_NAME.git"

echo ""
echo "=== 请先在GitHub上创建仓库 ==="
echo "1. 访问: https://github.com/new"
echo "2. Repository name: $REPO_NAME"
echo "3. 选择 Public 或 Private"
echo "4. 不要勾选 'Initialize this repository with a README'"
echo "5. 点击 'Create repository'"
echo ""
read -p "按回车键继续推送代码到GitHub..."

# 推送代码
echo ""
echo "正在推送代码到GitHub..."
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 成功！代码已上传到GitHub"
    echo "访问: https://github.com/$GITHUB_USERNAME/$REPO_NAME"
else
    echo ""
    echo "❌ 推送失败，请检查："
    echo "1. 是否已在GitHub上创建了仓库 '$REPO_NAME'"
    echo "2. 是否有推送权限"
    echo "3. 网络连接是否正常"
fi



