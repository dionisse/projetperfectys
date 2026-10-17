using System.Windows;

namespace Perfecto.Windows;

public partial class MainWindow : Window
{
    public MainWindow(IServiceProvider services)
    {
        InitializeComponent();
        BlazorView.Services = services;
    }
}
