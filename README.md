# Parabolic Chart & Alert

リアルタイムの株式・為替チャートを表示し、テクニカル指標のクロスと価格閾値の到達をトリガーにメール通知を行うWebアプリケーション。

## 主な機能

-   **リアルタイムチャート**: `lightweight-charts` を利用した軽快なチャート表示。
-   **マルチアセット対応**: 日本株とUSD/JPY為替レートの表示を切り替え可能。
-   **テクニカル指標**: ボリンジャーバンドと指数平滑移動平均（EMA）をチャート上に表示。
-   **クロス判定**: 終値が各指標ラインをまたいだ（クロスした）瞬間を検知し、画面にリアルタイムで通知。
-   **閾値アラート**: クロス発生後、価格がユーザー設定の閾値に到達した場合にメールで通知。
-   **永続的な設定**: ユーザーごとの銘柄、チャート設定、アラート閾値などをデータベースに保存。
-   **ユーザー認証**: ログイン・ログアウト機能、永続セッション管理。

## 技術スタック

#### バックエンド

-   **Node.js**: サーバーサイドJavaScriptランタイム
-   **Express.js**: Webアプリケーションフレームワーク
-   **PostgreSQL**: リレーショナルデータベース
-   **Socket.IO**: リアルタイム双方向通信
-   **pg**: Node.js用PostgreSQLクライアント
-   **nodemailer**: メール送信ライブラリ
-   **bcrypt**: パスワードハッシュ化
-   **express-session**: セッション管理

#### フロントエンド

-   **HTML5 / CSS3 / JavaScript (ES Modules)**
-   **lightweight-charts**: 高パフォーマンスな金融チャートライブラリ
-   **socket.io-client**: Socket.IOクライアント

#### インフラ & その他

-   **Docker / Docker Compose**: コンテナ化およびサービスオーケストレーション
-   **PM2**: Node.jsプロセス管理
-   **Nginx**: リバースプロキシ（構成ファイル同梱）
-   **AWS SSM Parameter Store**: 機密情報（Gmail認証情報）の管理
-   **Yahoo Finance API**: 株価および為替レートのデータソース

## プロジェクト構造

```
.
├── server.js               # バックエンドサーバーのエントリーポイント (Express, Socket.IO, Price Watcher)
├── client.js               # フロントエンドのメインロジック (チャート描画, API通信)
├── index.html              # メインのHTMLファイル
├── login.html              # ログインページ
├── register.html           # ユーザー登録ページ
├── style.css               # メインのCSSファイル
├── Dockerfile              # アプリケーションのDockerイメージをビルド
├── docker-compose.yml      # 本番環境用のDocker Compose設定
├── ecosystem.config.js     # PM2のプロセス管理設定
├── package.json            # Node.jsの依存関係とスクリプト
├── init-db.sql             # データベース初期化用のSQLスクリプト
└── nginx.conf              # Nginxリバースプロキシ用の設定ファイル
```

## セットアップと起動

#### 前提条件

-   Docker & Docker Compose
-   Node.js
-   `npm` or `yarn` or `pnpm`

#### 1. 環境変数の設定

プロジェクトのルートに`.env`ファイルを作成し、以下の内容を記述します。データベース接続情報やセッションの秘密鍵などを設定してください。

```ini
# PostgreSQL データベース接続URL
DATABASE_URL=postgresql://user:password@host:port/dbname

# Express-session の秘密鍵
SESSION_SECRET=your_very_secret_key_here

# AWS設定（SSMからGmail認証情報を取得するため）
AWS_REGION=ap-northeast-1
# ※ローカルで実行する場合は、別途 ~/.aws/credentials の設定が必要です

# セッションクッキーをセキュアにするか (本番環境では 'true')
COOKIE_SECURE=false
```

#### 2. ローカル開発環境での起動

1.  **依存関係のインストール**
    ```bash
    npm install
    ```

2.  **データベースの起動**
    データベース（PostgreSQL）を別途起動してください。Dockerを利用する場合:
    ```bash
    docker run --name some-postgres -e POSTGRES_PASSWORD=mysecretpassword -p 5432:5432 -d postgres
    ```

3.  **データベースの初期化**
    `init-db.sql`の内容を参考に、テーブルを作成してください。

4.  **バックエンドサーバーの起動**
    ```bash
    node server.js
    ```
    サーバーは `http://localhost:3000` で起動します。

#### 3. Dockerでの起動

1.  **環境変数の設定**
    上記と同様に`.env`ファイルを作成・編集します。Docker環境では、`DATABASE_URL`のホスト名を`docker-compose.yml`で定義したサービス名（例: `db`）に設定します。

2.  **コンテナのビルドと起動**
    -   **EC2環境でデプロイする場合**:
        ```bash
        docker-compose up --build
        ```
    -   **ローカル環境で開発する場合**: IAM認証情報をコンテナにパスするため、`docker-compose.local.yml`を併用します。
        ```bash
        docker-compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
        ```

3.  **アクセス**
    ブラウザで `http://localhost:3000` にアクセスします。（Nginxをリバースプロキシとして利用する場合はそのポート番号に従います）

4.  **ログの確認**
    ```bash
    docker-compose logs -f
    ```

5.  **停止**
    ```bash
    docker-compose down
    ```

## アーキテクチャのポイント

-   **柔軟なユーザー設定**: PostgreSQLの`JSONB`型を積極的に活用し、ユーザーごとの多様な設定（UI、アラート条件など）をスキーマ変更なしで柔軟に管理しています。
-   **堅牢なプロセス管理**: 本番環境では、Dockerコンテナ内でPM2がNode.jsプロセスを管理します。これにより、プロセスのクラッシュからの自動復旧や、CPUコアを最大限に活用するクラスタリングが可能になります。
-   **安全なシークレット管理**: メール送信用のパスワードなどの機密情報は、コードや`.env`ファイルに直接記述せず、AWS SSM Parameter Storeで一元管理しています。EC2インスタンスにアタッチされたIAMロールを通じて、安全にこれらの情報を取得します。
-   **永続セッション**: `express-session`とクッキーの`maxAge`設定により、ブラウザを閉じても一定期間ログイン状態が維持され、ユーザーの利便性を高めています。
