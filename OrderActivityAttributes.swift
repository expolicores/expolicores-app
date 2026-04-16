//frontend/OrderActivityAttributes.swift
import WidgetKit
import SwiftUI

// Atributos de la Live Activity
struct OrderActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var orderId: Int
        var status: String // CREADO | EN_CAMINO | ENTREGADO | CANCELADO
        var etaMinutes: Int?
        var driverName: String?
        var totalCOP: Int?
        var addressShort: String?
    }
    // Atributos fijos (no cambian durante la actividad)
    var storeName: String
}

// Widget/Live Activity UI (Lock Screen + Dynamic Island)
@main
struct OrderActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: OrderActivityAttributes.self) { context in
            // Lock Screen (expanded)
            VStack(alignment: .leading, spacing: 4) {
                Text("Expolicores")
                    .font(.headline)
                Text("Pedido #\(context.state.orderId) – \(context.state.status)")
                    .font(.subheadline)
                if let eta = context.state.etaMinutes, context.state.status == "EN_CAMINO" {
                    Text("Llegando en ~\(eta) min")
                }
                if let driver = context.state.driverName, !driver.isEmpty {
                    Text("Repartidor: \(driver)")
                }
                if let total = context.state.totalCOP {
                    Text("Total: $\(total)")
                }
                if let addr = context.state.addressShort, !addr.isEmpty {
                    Text(addr)
                }
            }
            .padding()
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text("#\(context.state.orderId)")
                        .font(.caption)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.status)
                        .font(.caption)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if let eta = context.state.etaMinutes {
                        Text("~\(eta) min")
                            .font(.caption)
                    }
                }
            } compactLeading: {
                Text("EC")
            } compactTrailing: {
                if let eta = context.state.etaMinutes {
                    Text("\(eta)")
                } else {
                    Image(systemName: "bottle")
                }
            } minimal: {
                Image(systemName: "bottle")
            }
        }
    }
}
