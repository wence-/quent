// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

use std::sync::{Arc, Mutex};

use quent_dynamic_attributes::DynamicValue;
use quent_model::EventCallback;
use quent_query_engine_analyzer::ui::UiAnalyzer;
use quent_query_engine_fixed as fixed;
use quent_simulator_analyzer::SimulatorUiAnalyzer;
use quent_simulator_instrumentation::SimulatorContext;

#[test]
fn query_bundle_retains_arbitrary_observations_in_timestamp_order() {
    let recorded = Arc::new(Mutex::new(Vec::new()));
    {
        let captured = Arc::clone(&recorded);
        let context = SimulatorContext::try_new(EventCallback::new(move |event| {
            captured.lock().unwrap().push(event);
        }))
        .unwrap();
        fixed::emit(&context);
    }

    let events = std::mem::take(&mut *recorded.lock().unwrap());
    let analyzer = SimulatorUiAnalyzer::try_new(fixed::ENGINE, events.into_iter()).unwrap();
    let bundle = analyzer.query_bundle(fixed::QUERY).unwrap();
    let observations = &bundle.entities.operators[&fixed::PHYS_FINAL_AGG].observations;

    assert_eq!(
        observations
            .iter()
            .map(|observation| observation.kind.as_str())
            .collect::<Vec<_>>(),
        ["algorithm.choice", "vendor.snapshot"]
    );
    assert!((observations[0].time_s - 2.8).abs() < 1e-12);
    assert!((observations[1].time_s - 2.9).abs() < 1e-12);
    assert_eq!(
        observations[0].custom_attributes.get("side"),
        Some(&Some(DynamicValue::String("left".to_string())))
    );
    assert_eq!(
        observations[1].custom_attributes.get("retained_rows"),
        Some(&Some(DynamicValue::U64(42)))
    );
}
