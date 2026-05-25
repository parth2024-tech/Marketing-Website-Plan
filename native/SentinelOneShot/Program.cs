using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using Sentinel.Shared;
using Sentinel.Uploader;

namespace SentinelOneShot;

static class Program
{
    [STAThread]
    static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        var form = new FormScanning();
        
        Task.Run(async () => 
        {
            try
            {
                // 1. Collect data
                var report = CollectorService.Collect();

                // 2. Setup HttpListener on random port
                int port = GetRandomUnusedPort();
                using var listener = new HttpListener();
                listener.Prefixes.Add($"http://localhost:{port}/");
                listener.Start();

                // 3. Open browser
                string callbackUrl = $"http://localhost:{port}/code";
                string targetUrl = $"https://sentinelapp.io/health-test?mode=oneshot&callback={Uri.EscapeDataString(callbackUrl)}";
                OpenBrowser(targetUrl);

                // 4. Wait for pair code
                string pairCode = await WaitForPairCodeAsync(listener);
                listener.Stop();

                if (!string.IsNullOrEmpty(pairCode))
                {
                    // 5. Upload report
                    var (success, reportId, claimToken) = await UploaderService.UploadPairCodeAsync(pairCode, report);
                    
                    if (success && !string.IsNullOrEmpty(reportId) && !string.IsNullOrEmpty(claimToken))
                    {
                        // 6. Open report in browser
                        OpenBrowser($"https://sentinelapp.io/r/{reportId}?claim={claimToken}");
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"An error occurred: {ex.Message}", "Sentinel Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                // Close form on UI thread
                form.Invoke(new Action(() => form.Close()));
            }
        });

        Application.Run(form);

        // 7. Self-delete
        SelfDelete();
    }

    private static int GetRandomUnusedPort()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        int port = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        return port;
    }

    private static void OpenBrowser(string url)
    {
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = url,
                UseShellExecute = true
            });
        }
        catch { }
    }

    private static async Task<string> WaitForPairCodeAsync(HttpListener listener)
    {
        var timeoutTask = Task.Delay(TimeSpan.FromMinutes(5));

        while (true)
        {
            var contextTask = listener.GetContextAsync();

            var completedTask = await Task.WhenAny(contextTask, timeoutTask);
            if (completedTask == timeoutTask)
            {
                throw new Exception("Timeout waiting for pair code from browser.");
            }

            var context = await contextTask;
            var request = context.Request;
            var response = context.Response;

            if (request.HttpMethod == "POST" && request.Url?.AbsolutePath == "/code")
            {
                using var reader = new StreamReader(request.InputStream, request.ContentEncoding);
                string pairCode = await reader.ReadToEndAsync();
                
                // Send CORS headers and success
                response.StatusCode = 200;
                response.Headers.Add("Access-Control-Allow-Origin", "*");
                byte[] buffer = Encoding.UTF8.GetBytes("OK");
                response.ContentLength64 = buffer.Length;
                await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                response.OutputStream.Close();
                return pairCode;
            }
            else if (request.HttpMethod == "OPTIONS")
            {
                response.StatusCode = 204;
                response.Headers.Add("Access-Control-Allow-Origin", "*");
                response.Headers.Add("Access-Control-Allow-Methods", "POST, OPTIONS");
                response.Headers.Add("Access-Control-Allow-Headers", "Content-Type");
                response.OutputStream.Close();
            }
            else
            {
                response.StatusCode = 404;
                response.OutputStream.Close();
            }
        }
    }

    private static void SelfDelete()
    {
        try
        {
            string batchPath = Path.Combine(Path.GetTempPath(), "sentinel_cleanup.bat");
            string exePath = Process.GetCurrentProcess().MainModule?.FileName ?? "";

            if (string.IsNullOrEmpty(exePath)) return;

            string batchCode = $@"
@echo off
ping -n 3 127.0.0.1 > nul
del ""{exePath}""
del ""%~f0""
";
            File.WriteAllText(batchPath, batchCode);

            var psi = new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = $"/c \"{batchPath}\"",
                WindowStyle = ProcessWindowStyle.Hidden,
                CreateNoWindow = true
            };
            Process.Start(psi);
        }
        catch { }
    }
}
