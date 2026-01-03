module.exports = {
  apps: [{
    name: "parabolic-app",
    cwd: "/home/ec2-user/parabolic",
    script: "npm",
    args: "start",
    env: {
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://parabolic_user:StrongPass_ChangeMe@127.0.0.1:5432/parabolic"
    }
  }]
};
