module.exports = {
  // ... other webpack configurations
  devServer: {
    static: {
      directory: path.join(__dirname, 'public'),
    },
    port: 8080,
  },
};