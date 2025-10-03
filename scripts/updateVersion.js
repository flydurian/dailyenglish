#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 현재 타임스탬프
const buildTime = new Date().toISOString();

// 소스 파일들의 해시를 기반으로 앱 해시 생성
const srcPath = path.join(__dirname, '..', 'src');
const publicPath = path.join(__dirname, '..', 'public');

let hashSource = '';

// src 디렉토리의 모든 파일 해시 생성
function generateDirHash(dirPath, relativePath = '') {
    try {
        const files = fs.readdirSync(dirPath);
        
        files.forEach(file => {
            const filePath = path.join(dirPath, file);
            const relativeFilePath = path.join(relativePath, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory()) {
                generateDirHash(filePath, relativeFilePath);
            } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.css') || file.endsWith('.json')) {
                const content = fs.readFileSync(filePath, 'utf8');
                const fileHash = crypto.createHash('md5').update(content).digest('hex');
                hashSource += `${relativeFilePath}:${fileHash};`;
            }
        });
    } catch (error) {
        console.warn(`경고: ${dirPath} 디렉토리를 읽을 수 없습니다.`);
    }
}

// 소스 파일들 해시 생성
generateDirHash(srcPath, 'src');

// 빌드 시간 추가
hashSource += `buildTime:${buildTime}`;

// 최종 앱 해시 생성
const appHash = crypto.createHash('md5').update(hashSource).digest('hex');

// hash.json 업데이트
const hashInfo = {
    hash: appHash,
    buildTime: buildTime,
    description: "Daily English App Hash Info"
};

const hashPath = path.join(__dirname, '..', 'public', 'hash.json');
fs.writeFileSync(hashPath, JSON.stringify(hashInfo, null, 2));

console.log(`✅ 해시 정보 업데이트 완료:`);
console.log(`   빌드 시간: ${buildTime}`);
console.log(`   앱 해시: ${appHash.substring(0, 16)}...`);
console.log(`   해시 길이: ${appHash.length}자`);
